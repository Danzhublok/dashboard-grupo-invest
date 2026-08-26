create or replace function public.revoke_sale_cancellation(sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_record public.sales%rowtype;
  sale_month date;
begin
  select * into sale_record from public.sales where id = sale_id for update;
  if not found then
    raise exception 'Venda nao encontrada.';
  end if;
  if not public.can_access_representation(sale_record.representation_id) then
    raise exception 'Sem permissao para revogar este cancelamento.';
  end if;
  if sale_record.status <> 'cancelada' then
    raise exception 'Esta venda nao esta cancelada.';
  end if;

  sale_month := date_trunc('month', sale_record.sold_at)::date;

  update public.sales
  set status = 'ativa', cancellation_reason = null, cancelled_at = null
  where id = sale_id;

  insert into public.collaborator_results (
    collaborator_id, month, first_half, second_half, quotas
  ) values (
    sale_record.collaborator_id,
    sale_month,
    case when sale_record.half = 'quinzena1' then sale_record.amount else 0 end,
    case when sale_record.half = 'quinzena2' then sale_record.amount else 0 end,
    1
  )
  on conflict (collaborator_id, month) do update
  set first_half = public.collaborator_results.first_half
        + case when sale_record.half = 'quinzena1' then sale_record.amount else 0 end,
      second_half = public.collaborator_results.second_half
        + case when sale_record.half = 'quinzena2' then sale_record.amount else 0 end,
      quotas = public.collaborator_results.quotas + 1,
      updated_at = now();

  update public.collaborators
  set quotas = quotas + 1, updated_at = now()
  where id = sale_record.collaborator_id;
end;
$$;
