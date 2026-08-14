-- Dados importados do controle de contratos da primeira quinzena de agosto/2026.
-- Cada linha é uma cota independente, inclusive quando o consultor se repete.

do $$
declare
  sale_data record;
  collaborator_ids uuid[];
  representation_ids uuid[];
  matched_collaborator_id uuid;
  matched_representation_id uuid;
begin
  for sale_data in
    select * from (
      values
        (date '2026-08-04', 'Samya', 184545.18::numeric, false),
        (date '2026-08-05', 'Tamirys', 201248.00::numeric, true),
        (date '2026-08-05', 'Elienai', 152343.68::numeric, false),
        (date '2026-08-05', 'Reinaldo', 76893.82::numeric, false),
        (date '2026-08-05', 'Lucas Valente', 246060.25::numeric, false),
        (date '2026-08-06', 'Paulo', 342306.96::numeric, false),
        (date '2026-08-06', 'Samya', 92272.59::numeric, false),
        (date '2026-08-06', 'Hugo', 152343.68::numeric, false),
        (date '2026-08-07', 'Valéria', 208767.26::numeric, false),
        (date '2026-08-07', 'Diego', 321614.43::numeric, false),
        (date '2026-08-08', 'Paulo', 208767.26::numeric, false),
        (date '2026-08-08', 'Paulo', 46060.22::numeric, false),
        (date '2026-08-08', 'Pedro', 253906.13::numeric, false),
        (date '2026-08-08', 'Gabriela', 261439.00::numeric, false),
        (date '2026-08-10', 'Maria', 287760.28::numeric, false),
        (date '2026-08-10', 'Sury', 92742.59::numeric, false),
        (date '2026-08-12', 'Wagner', 138408.89::numeric, false),
        (date '2026-08-12', 'Sury', 65577.45::numeric, false),
        (date '2026-08-13', 'Samya', 304687.35::numeric, false),
        (date '2026-08-13', 'Ana Laura', 315972.08::numeric, false)
    ) as rows(sold_on, consultant_name, amount, is_cancelled)
  loop
    select array_agg(collaborator.id), array_agg(collaborator.representation_id)
      into collaborator_ids, representation_ids
    from public.collaborators as collaborator
    where lower(trim(collaborator.full_name)) = lower(trim(sale_data.consultant_name));

    if coalesce(cardinality(collaborator_ids), 0) <> 1 then
      raise exception 'Consultor "%" não foi encontrado de forma única para a importação.', sale_data.consultant_name;
    end if;

    matched_collaborator_id := collaborator_ids[1];
    matched_representation_id := representation_ids[1];

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
      case when sale_data.is_cancelled then 'Venda cancelada — marcada em vermelho na planilha de origem' end,
      case when sale_data.is_cancelled then now() end
    );

    -- A venda cancelada fica apenas no histórico; não soma valor nem cota.
    if not sale_data.is_cancelled then
      insert into public.collaborator_results (
        collaborator_id,
        month,
        first_half,
        second_half,
        quotas
      ) values (
        matched_collaborator_id,
        sale_data.sold_on,
        sale_data.amount,
        0,
        1
      ) on conflict (collaborator_id, month) do update
      set first_half = public.collaborator_results.first_half + excluded.first_half,
          quotas = public.collaborator_results.quotas + excluded.quotas,
          updated_at = now();

      update public.collaborators
      set quotas = quotas + 1, updated_at = now()
      where id = matched_collaborator_id;
    end if;
  end loop;
end;
$$;
