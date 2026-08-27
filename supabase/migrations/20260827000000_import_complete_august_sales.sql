-- Importa o controle de contratos completo de agosto/2026 (duas quinzenas).
-- As linhas vermelhas da planilha sao mantidas no historico como canceladas.
-- A migracao e idempotente: substitui somente as vendas e resultados de agosto/2026.

do $$
declare
  sale_data record;
  matched_collaborator_id uuid;
  matched_representation_id uuid;
  matches integer;
begin
  delete from public.sales
  where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
    and sold_at < timestamptz '2026-09-01 00:00:00-03:00';

  delete from public.collaborator_results
  where month >= date '2026-08-01'
    and month < date '2026-09-01';

  for sale_data in
    select * from (
      values
        -- Primeira quinzena
        (date '2026-08-04', 'Ana',      'Samya',         184545.18::numeric, 'quinzena1', false),
        (date '2026-08-05', 'Manoel',   'Tamirys',       201248.00::numeric, 'quinzena1', true),
        (date '2026-08-05', 'Elienai',  'Elienai',       152343.68::numeric, 'quinzena1', false),
        (date '2026-08-05', 'Reinaldo', 'Reinaldo',       76893.82::numeric, 'quinzena1', false),
        (date '2026-08-05', 'Manoel',   'Lucas Valente', 246060.25::numeric, 'quinzena1', false),
        (date '2026-08-06', 'Manoel',   'Paulo',         342306.96::numeric, 'quinzena1', false),
        (date '2026-08-06', 'Ana',      'Samya',          92272.59::numeric, 'quinzena1', false),
        (date '2026-08-06', 'Lucas',    'Hugo',          152343.68::numeric, 'quinzena1', false),
        (date '2026-08-07', 'Manoel',   'Valeria',       208767.26::numeric, 'quinzena1', false),
        (date '2026-08-07', 'Manoel',   'Diego',         321614.43::numeric, 'quinzena1', false),
        (date '2026-08-08', 'Manoel',   'Paulo',         208767.26::numeric, 'quinzena1', false),
        (date '2026-08-08', 'Manoel',   'Paulo',         246060.22::numeric, 'quinzena1', false),
        (date '2026-08-08', 'Lucas',    'Pedro',         253906.13::numeric, 'quinzena1', false),
        (date '2026-08-08', 'Wendel',   'Gabriela',      261439.00::numeric, 'quinzena1', false),
        (date '2026-08-11', 'Sury',     'Maria',         287760.28::numeric, 'quinzena1', false),
        (date '2026-08-10', 'Sury',     'Micaella',       92272.59::numeric, 'quinzena1', false),
        (date '2026-08-12', 'Wendel',   'Wagner',        138408.89::numeric, 'quinzena1', false),
        (date '2026-08-12', 'Sury',     'Micaella',       65577.45::numeric, 'quinzena1', false),
        (date '2026-08-13', 'Ana',      'Samya',         304687.35::numeric, 'quinzena1', true),
        (date '2026-08-13', 'Ana',      'Ana Laura',     315972.08::numeric, 'quinzena1', false),
        (date '2026-08-14', 'Manoel',   'Valeria',       304687.36::numeric, 'quinzena1', false),

        -- Segunda quinzena
        (date '2026-08-15', 'Gustavo',  'Julia',         107651.36::numeric, 'quinzena2', false),
        (date '2026-08-15', 'Wendel',   'Wagner',        812499.60::numeric, 'quinzena2', false),
        (date '2026-08-17', 'Messias',  'Daiana',         92272.59::numeric, 'quinzena2', true),
        (date '2026-08-18', 'Manoel',   'Paulo',         107651.36::numeric, 'quinzena2', false),
        (date '2026-08-18', 'Geovanna', 'Wanessa',       107651.36::numeric, 'quinzena2', false),
        (date '2026-08-18', 'Elienai',  'Cristhian',     253906.13::numeric, 'quinzena2', true),
        (date '2026-08-19', 'Manoel',   'Paulo',         230681.46::numeric, 'quinzena2', false),
        (date '2026-08-19', 'Elienai',  'Elienai',        92272.59::numeric, 'quinzena2', false),
        (date '2026-08-19', 'Elienai',  'Rian',          220051.98::numeric, 'quinzena2', false),
        (date '2026-08-19', 'Ana',      'Samya',         354535.96::numeric, 'quinzena2', false),
        (date '2026-08-18', 'Mayara',   'Sabrina',       208767.26::numeric, 'quinzena2', false),
        (date '2026-08-20', 'Sury',     'Maria',         115340.73::numeric, 'quinzena2', false),
        (date '2026-08-20', 'Gustavo',  'Julia',          43718.30::numeric, 'quinzena2', false),
        (date '2026-08-21', 'Geovanna', 'Gizelma',       153787.64::numeric, 'quinzena2', false),
        (date '2026-08-21', 'Manoel',   'Diego',         199923.95::numeric, 'quinzena2', false),
        (date '2026-08-21', 'Gustavo',  'Julia',          76893.82::numeric, 'quinzena2', true),
        (date '2026-08-21', 'Wendel',   'Hernandes',      92272.59::numeric, 'quinzena2', false),
        (date '2026-08-21', 'Sury',     'Fernanda',      123030.11::numeric, 'quinzena2', false),
        (date '2026-08-22', 'Sury',     'Fernanda',      174913.11::numeric, 'quinzena2', true),
        (date '2026-08-24', 'Gustavo',  'Harley',        201248.00::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Manoel',   'Lucas Valente', 141058.96::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Ana',      'Giehdra',        76893.82::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Manoel',   'Valeria',       304687.35::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Ana',      'Samya',         115340.73::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Wendel',   'Kairon',         54647.88::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Geovanna', 'Gizelma',        76893.82::numeric, 'quinzena2', false),
        (date '2026-08-25', 'Sury',     'Maria',         123030.11::numeric, 'quinzena2', false),
        (date '2026-08-26', 'Geovanna', 'Gizelma',        92272.59::numeric, 'quinzena2', false),
        (date '2026-08-26', 'Sury',     'Stephanny',      76893.82::numeric, 'quinzena2', false)
    ) as rows(sold_on, manager_name, consultant_name, sale_amount, sale_half, is_cancelled)
  loop
    select
      count(*),
      (array_agg(collaborator.id))[1],
      (array_agg(collaborator.representation_id))[1]
      into matches, matched_collaborator_id, matched_representation_id
    from public.collaborators as collaborator
    where (
      translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
        = translate(lower(trim(sale_data.consultant_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
      or (
        sale_data.consultant_name = 'Micaella'
        and translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') in ('micaela', 'micaella')
      )
      or (
        sale_data.consultant_name = 'Giehdra'
        and replace(translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), 'h', '')
          = replace(translate(lower(trim(sale_data.consultant_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), 'h', '')
      )
    );

    -- O nome do gerente so e necessario quando o nome do consultor se repete.
    if matches > 1 then
      select
        count(*),
        (array_agg(collaborator.id))[1],
        (array_agg(collaborator.representation_id))[1]
        into matches, matched_collaborator_id, matched_representation_id
      from public.collaborators as collaborator
      join public.representations as representation
        on representation.id = collaborator.representation_id
      left join public.collaborators as manager
        on manager.representation_id = collaborator.representation_id
       and translate(lower(trim(manager.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
         = translate(lower(trim(sale_data.manager_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
      where (
        translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
          = translate(lower(trim(sale_data.consultant_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
        or (
          sale_data.consultant_name = 'Micaella'
          and translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') in ('micaela', 'micaella')
        )
        or (
          sale_data.consultant_name = 'Giehdra'
          and replace(translate(lower(trim(collaborator.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), 'h', '')
            = replace(translate(lower(trim(sale_data.consultant_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), 'h', '')
        )
      )
        and (
          (
            translate(lower(trim(sale_data.consultant_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') = 'daiana'
            and translate(lower(trim(representation.name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') = 'roma'
          )
          or manager.id is not null
          or exists (
            select 1
            from public.representation_members as membership
            join public.profiles as profile on profile.id = membership.user_id
            where membership.representation_id = collaborator.representation_id
              and translate(lower(trim(profile.full_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
                = translate(lower(trim(sale_data.manager_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
          )
          or translate(lower(trim(coalesce(nullif(representation.representative_name, ''), representation.name))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
            = translate(lower(trim(sale_data.manager_name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
        );
    end if;

    if matches <> 1 then
      raise exception 'Consultor "%" do gerente "%" nao foi encontrado de forma unica (encontrados: %).',
        sale_data.consultant_name, sale_data.manager_name, matches;
    end if;

    insert into public.sales (
      representation_id, collaborator_id, amount, half, sold_at, status,
      cancellation_reason, cancelled_at
    ) values (
      matched_representation_id,
      matched_collaborator_id,
      sale_data.sale_amount,
      sale_data.sale_half,
      (sale_data.sold_on::text || 'T12:00:00-03:00')::timestamptz,
      case when sale_data.is_cancelled then 'cancelada'::public.sale_status else 'ativa'::public.sale_status end,
      case when sale_data.is_cancelled then 'Venda cancelada - marcada em vermelho na planilha de origem' end,
      case when sale_data.is_cancelled then now() end
    );
  end loop;

  insert into public.collaborator_results (
    collaborator_id, month, first_half, second_half, quotas
  )
  select
    sale.collaborator_id,
    date '2026-08-01',
    coalesce(sum(sale.amount) filter (where sale.half = 'quinzena1'), 0),
    coalesce(sum(sale.amount) filter (where sale.half = 'quinzena2'), 0),
    count(*)::integer
  from public.sales as sale
  where sale.sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
    and sale.sold_at < timestamptz '2026-09-01 00:00:00-03:00'
    and sale.status = 'ativa'
  group by sale.collaborator_id;

  update public.collaborators as collaborator
  set quotas = result.quotas,
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
        and sold_at < timestamptz '2026-09-01 00:00:00-03:00') <> 50 then
    raise exception 'A importacao deveria gerar 50 vendas.';
  end if;

  if (select count(*) from public.sales
      where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
        and sold_at < timestamptz '2026-09-01 00:00:00-03:00'
        and status = 'cancelada') <> 6 then
    raise exception 'A importacao deveria gerar 6 vendas canceladas.';
  end if;

  if (select coalesce(sum(amount), 0) from public.sales
      where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
        and sold_at < timestamptz '2026-09-01 00:00:00-03:00'
        and half = 'quinzena1'
        and status = 'ativa') <> 3951999.11::numeric then
    raise exception 'O total ativo da primeira quinzena deveria ser R$ 3.951.999,11.';
  end if;

  if (select coalesce(sum(amount), 0) from public.sales
      where sold_at >= timestamptz '2026-08-01 00:00:00-03:00'
        and sold_at < timestamptz '2026-09-01 00:00:00-03:00'
        and half = 'quinzena2'
        and status = 'ativa') <> 4232803.33::numeric then
    raise exception 'O total ativo da segunda quinzena deveria ser R$ 4.232.803,33.';
  end if;
end;
$$;
