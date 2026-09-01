create or replace function public.replace_sales_import(
  import_month date,
  import_half text,
  imported_sales jsonb
)
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
    raise exception 'Somente administradores podem importar planilhas.';
  end if;
  if import_month <> date_trunc('month', import_month)::date then
    raise exception 'Mês de importação inválido.';
  end if;
  if import_half not in ('quinzena1', 'quinzena2') then
    raise exception 'Quinzena inválida.';
  end if;
  if jsonb_typeof(imported_sales) <> 'array' or jsonb_array_length(imported_sales) = 0 then
    raise exception 'A importação não contém vendas.';
  end if;

  -- Validate every row before deleting the previous import.
  for item in select * from jsonb_array_elements(imported_sales)
  loop
    sale_date := (item->>'date')::date;
    select * into collaborator_record from public.collaborators where id = (item->>'collaboratorId')::uuid;
    if not found or collaborator_record.representation_id <> (item->>'representationId')::uuid then
      raise exception 'Colaborador inválido na linha %.', item->>'row';
    end if;
    if date_trunc('month', sale_date)::date <> import_month
       or (case when extract(day from sale_date) <= 14 then 'quinzena1' else 'quinzena2' end) <> import_half
       or (item->>'amount')::numeric <= 0 then
      raise exception 'Data, quinzena ou valor inválido na linha %.', item->>'row';
    end if;
  end loop;

  delete from public.sales
  where sold_at >= import_month
    and sold_at < (import_month + interval '1 month')
    and half = import_half;

  for item in select * from jsonb_array_elements(imported_sales)
  loop
    insert into public.sales (representation_id, collaborator_id, amount, half, sold_at, created_by)
    values (
      (item->>'representationId')::uuid,
      (item->>'collaboratorId')::uuid,
      (item->>'amount')::numeric,
      import_half,
      ((item->>'date') || 'T12:00:00-03:00')::timestamptz,
      auth.uid()
    );
  end loop;

  delete from public.collaborator_results where month = import_month;
  insert into public.collaborator_results (collaborator_id, month, first_half, second_half, quotas)
  select collaborator_id, import_month,
    coalesce(sum(amount) filter (where half = 'quinzena1'), 0),
    coalesce(sum(amount) filter (where half = 'quinzena2'), 0),
    count(*)::integer
  from public.sales
  where sold_at >= import_month and sold_at < import_month + interval '1 month' and status = 'ativa'
  group by collaborator_id;
end;
$$;

revoke all on function public.replace_sales_import(date, text, jsonb) from public;
grant execute on function public.replace_sales_import(date, text, jsonb) to authenticated;
