create or replace function public.replace_sales_import_batch(imported_sales jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  collaborator_record public.collaborators%rowtype;
  sale_date date;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem importar arquivos.';
  end if;
  if jsonb_typeof(imported_sales) <> 'array' or jsonb_array_length(imported_sales) = 0 then
    raise exception 'A importação não contém vendas.';
  end if;

  for item in select * from jsonb_array_elements(imported_sales)
  loop
    sale_date := (item->>'date')::date;
    select * into collaborator_record from public.collaborators where id = (item->>'collaboratorId')::uuid;
    if not found or collaborator_record.representation_id <> (item->>'representationId')::uuid then
      raise exception 'Colaborador inválido na linha %.', item->>'row';
    end if;
    if (item->>'amount')::numeric <= 0 then
      raise exception 'Valor inválido na linha %.', item->>'row';
    end if;
  end loop;

  delete from public.sales sale
  using (
    select distinct date_trunc('month', (row->>'date')::date)::date as month,
      case when extract(day from (row->>'date')::date) <= 14 then 'quinzena1' else 'quinzena2' end as half
    from jsonb_array_elements(imported_sales) row
  ) period
  where sale.sold_at >= period.month
    and sale.sold_at < period.month + interval '1 month'
    and sale.half = period.half;

  for item in select * from jsonb_array_elements(imported_sales)
  loop
    sale_date := (item->>'date')::date;
    insert into public.sales (representation_id, collaborator_id, amount, half, sold_at, created_by)
    values (
      (item->>'representationId')::uuid,
      (item->>'collaboratorId')::uuid,
      (item->>'amount')::numeric,
      case when extract(day from sale_date) <= 14 then 'quinzena1' else 'quinzena2' end,
      ((item->>'date') || 'T12:00:00-03:00')::timestamptz,
      auth.uid()
    );
  end loop;

  delete from public.collaborator_results result
  using (
    select distinct date_trunc('month', (row->>'date')::date)::date as month
    from jsonb_array_elements(imported_sales) row
  ) period
  where result.month = period.month;

  insert into public.collaborator_results (collaborator_id, month, first_half, second_half, quotas)
  select sale.collaborator_id, date_trunc('month', sale.sold_at)::date,
    coalesce(sum(sale.amount) filter (where sale.half = 'quinzena1'), 0),
    coalesce(sum(sale.amount) filter (where sale.half = 'quinzena2'), 0),
    count(*)::integer
  from public.sales sale
  where sale.status = 'ativa'
    and date_trunc('month', sale.sold_at)::date in (
      select distinct date_trunc('month', (row->>'date')::date)::date
      from jsonb_array_elements(imported_sales) row
    )
  group by sale.collaborator_id, date_trunc('month', sale.sold_at)::date;
end;
$$;

revoke all on function public.replace_sales_import_batch(jsonb) from public;
grant execute on function public.replace_sales_import_batch(jsonb) to authenticated;
