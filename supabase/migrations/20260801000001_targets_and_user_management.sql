create table if not exists public.collaborator_targets (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collaborator_id, month)
);

alter table public.collaborator_targets enable row level security;

create policy "users read allowed collaborator targets" on public.collaborator_targets
  for select using (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id and public.can_access_representation(c.representation_id)
    )
  );
create policy "admins manage collaborator targets" on public.collaborator_targets
  for all using (public.is_admin()) with check (public.is_admin());
create policy "representatives manage own collaborator targets" on public.collaborator_targets
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

create or replace function public.delete_representative_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem excluir usuários';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;
