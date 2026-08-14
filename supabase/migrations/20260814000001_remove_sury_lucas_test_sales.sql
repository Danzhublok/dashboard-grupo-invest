do $$
declare
  sale_record public.sales%rowtype;
begin
  for sale_record in
    delete from public.sales as sale
    using public.collaborators as collaborator
    where sale.collaborator_id = collaborator.id
      and lower(trim(collaborator.full_name)) in ('sury', 'lucas valente')
    returning sale.*
  loop
    -- Apenas vendas ativas ainda compõem o resultado e as cotas.
    if sale_record.status = 'ativa' then
      update public.collaborator_results
      set first_half = case
            when sale_record.half = 'quinzena1' then greatest(0, first_half - sale_record.amount)
            else first_half
          end,
          second_half = case
            when sale_record.half = 'quinzena2' then greatest(0, second_half - sale_record.amount)
            else second_half
          end,
          quotas = greatest(0, quotas - 1),
          updated_at = now()
      where collaborator_id = sale_record.collaborator_id
        and month = sale_record.sold_at::date;

      update public.collaborators
      set quotas = greatest(0, quotas - 1), updated_at = now()
      where id = sale_record.collaborator_id;
    end if;
  end loop;
end;
$$;
