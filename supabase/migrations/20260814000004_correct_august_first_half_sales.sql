-- Corrige a primeira quinzena de agosto/2026 conforme a planilha de contratos.
-- A carga e idempotente: substitui somente as vendas deste periodo.

do $$
declare
  sale_data record;
  matched_collaborator_id uuid;
  matched_representation_id uuid;
  matches integer;
begin
  delete from public.sales
  where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
    and sold_at < timestamptz '2026-08-16 00:00:00-03:00';

  delete from public.collaborator_results
  where month >= date '2026-08-01'
    and month < date '2026-09-01';

  for sale_data in
    select * from (
      values
        (date '2026-08-04', 'Samya',     184545.18::numeric, false),
        (date '2026-08-05', 'Tamirys',   201248.00::numeric, true),
        (date '2026-08-05', 'Elienai',   152343.68::numeric, false),
        (date '2026-08-05', 'Reinaldo',   76893.82::numeric, false),
        (date '2026-08-05', 'Lucas Valente', 246060.25::numeric, false),
        (date '2026-08-06', 'Paulo',     342306.96::numeric, false),
        (date '2026-08-06', 'Samya',      92272.59::numeric, false),
        (date '2026-08-06', 'Hugo',      152343.68::numeric, false),
        (date '2026-08-07', 'Valéria',   208767.26::numeric, false),
        (date '2026-08-07', 'Diego',     321614.43::numeric, false),
        (date '2026-08-08', 'Paulo',     208767.26::numeric, false),
        (date '2026-08-08', 'Paulo',     246060.22::numeric, false),
        (date '2026-08-08', 'Pedro',     253906.13::numeric, false),
        (date '2026-08-08', 'Gabriela',  261439.00::numeric, false),
        (date '2026-08-11', 'Maria',     287760.28::numeric, false),
        (date '2026-08-10', 'Sury',       92272.59::numeric, false),
        (date '2026-08-12', 'Wagner',    138408.89::numeric, false),
        (date '2026-08-12', 'Sury',       65577.45::numeric, false),
        (date '2026-08-13', 'Samya',     304687.35::numeric, false),
        (date '2026-08-13', 'Ana Laura', 315972.08::numeric, false),
        (date '2026-08-14', 'Valéria',   304687.36::numeric, false)
    ) as rows(sold_on, consultant_name, amount, is_cancelled)
  loop
    select
      count(*),
      (array_agg(collaborator.id))[1],
      (array_agg(collaborator.representation_id))[1]
      into matches, matched_collaborator_id, matched_representation_id
    from public.collaborators as collaborator
    where lower(trim(collaborator.full_name)) = lower(trim(sale_data.consultant_name));

    if matches <> 1 then
      raise exception 'Consultor "%" nao foi encontrado de forma unica.', sale_data.consultant_name;
    end if;

    insert into public.sales (
      representation_id,
      collaborator_id,
      amount,
      half,
      sold_at,
      status,
      cancellation_reason,
      cancelled_at
    ) values (
      matched_representation_id,
      matched_collaborator_id,
      sale_data.amount,
      'quinzena1',
      (sale_data.sold_on::text || 'T12:00:00-03:00')::timestamptz,
      case when sale_data.is_cancelled then 'cancelada'::public.sale_status else 'ativa'::public.sale_status end,
      case when sale_data.is_cancelled then 'Venda cancelada - marcada em vermelho na planilha de origem' end,
      case when sale_data.is_cancelled then now() end
    );
  end loop;

  insert into public.collaborator_results (
    collaborator_id,
    month,
    first_half,
    second_half,
    quotas
  )
  select
    sale.collaborator_id,
    date '2026-08-01',
    sum(sale.amount),
    0,
    count(*)
  from public.sales as sale
  where sale.sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
    and sale.sold_at < timestamptz '2026-08-16 00:00:00-03:00'
    and sale.status = 'ativa'
  group by sale.collaborator_id;

  update public.collaborators as collaborator
  set quotas = coalesce(result.quotas, 0),
      updated_at = now()
  from (
    select c.id, count(s.id)::integer as quotas
    from public.collaborators as c
    left join public.sales as s
      on s.collaborator_id = c.id
      and s.status = 'ativa'
      and s.sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
      and s.sold_at < timestamptz '2026-09-01 00:00:00-03:00'
    group by c.id
  ) as result
  where collaborator.id = result.id;

  if (select count(*) from public.sales
      where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
        and sold_at < timestamptz '2026-08-16 00:00:00-03:00') <> 21 then
    raise exception 'A importacao deveria gerar 21 vendas.';
  end if;
end;
$$;
