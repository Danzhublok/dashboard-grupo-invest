create type public.sale_status as enum ('ativa', 'cancelada');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.representations(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  half text not null check (half in ('quinzena1', 'quinzena2')),
  sold_at timestamptz not null default now(),
  status public.sale_status not null default 'ativa',
  cancellation_reason text,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint sales_cancellation_details check (
    (status = 'ativa' and cancellation_reason is null and cancelled_at is null)
    or (status = 'cancelada' and cancellation_reason is not null and cancelled_at is not null)
  )
);

create index sales_representation_sold_at_idx on public.sales (representation_id, sold_at desc);
create index sales_collaborator_sold_at_idx on public.sales (collaborator_id, sold_at desc);

alter table public.sales enable row level security;

create policy "users read allowed sales" on public.sales
  for select using (public.can_access_representation(representation_id));
create policy "members create sales" on public.sales
  for insert with check (
    public.can_access_representation(representation_id)
    and (created_by is null or created_by = auth.uid())
  );
create policy "members update allowed sales" on public.sales
  for update using (public.can_access_representation(representation_id))
  with check (public.can_access_representation(representation_id));

create policy "members manage their collaborator results" on public.collaborator_results
  for all using (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id and public.can_access_representation(c.representation_id)
    )
  ) with check (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id and public.can_access_representation(c.representation_id)
    )
  );

create or replace function public.cancel_sale(sale_id uuid, reason text)
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
    raise exception 'Venda não encontrada.';
  end if;
  if not public.can_access_representation(sale_record.representation_id) then
    raise exception 'Sem permissão para cancelar esta venda.';
  end if;
  if sale_record.status = 'cancelada' then
    raise exception 'Esta venda já foi cancelada.';
  end if;
  if length(trim(reason)) = 0 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  sale_month := sale_record.sold_at::date;
  update public.sales
  set status = 'cancelada', cancellation_reason = trim(reason), cancelled_at = now()
  where id = sale_id;

  update public.collaborator_results
  set first_half = case when sale_record.half = 'quinzena1' then greatest(0, first_half - sale_record.amount) else first_half end,
      second_half = case when sale_record.half = 'quinzena2' then greatest(0, second_half - sale_record.amount) else second_half end,
      quotas = greatest(0, quotas - 1),
      updated_at = now()
  where collaborator_id = sale_record.collaborator_id and month = sale_month;

  update public.collaborators
  set quotas = greatest(0, quotas - 1), updated_at = now()
  where id = sale_record.collaborator_id;
end;
$$;
