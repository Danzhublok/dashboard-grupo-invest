create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'representante');

create table public.representations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  representative_name text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'representante',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.representation_members (
  user_id uuid not null references public.profiles(id) on delete cascade,
  representation_id uuid not null references public.representations(id) on delete cascade,
  primary key (user_id, representation_id)
);

create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.representations(id) on delete cascade,
  full_name text not null,
  role text not null default 'consultor' check (role in ('consultor', 'supervisor', 'representante')),
  avatar_url text,
  quotas integer not null default 0 check (quotas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_results (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.representations(id) on delete cascade,
  month date not null,
  first_half numeric(14,2) not null default 0 check (first_half >= 0),
  second_half numeric(14,2) not null default 0 check (second_half >= 0),
  quotas integer not null default 0 check (quotas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (representation_id, month)
);

create table public.collaborator_results (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  month date not null,
  first_half numeric(14,2) not null default 0 check (first_half >= 0),
  second_half numeric(14,2) not null default 0 check (second_half >= 0),
  quotas integer not null default 0 check (quotas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collaborator_id, month)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.representations(id) on delete cascade,
  reason text not null,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.representations(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (representation_id, month)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_representation(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.representation_members
    where user_id = auth.uid() and representation_id = target_id
  );
$$;

alter table public.representations enable row level security;
alter table public.profiles enable row level security;
alter table public.representation_members enable row level security;
alter table public.collaborators enable row level security;
alter table public.monthly_results enable row level security;
alter table public.collaborator_results enable row level security;
alter table public.expenses enable row level security;
alter table public.targets enable row level security;

create policy "users read their profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read allowed representations" on public.representations
  for select using (public.can_access_representation(id));
create policy "admins manage representations" on public.representations
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read their memberships" on public.representation_members
  for select using (user_id = auth.uid() or public.is_admin());
create policy "admins manage memberships" on public.representation_members
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read allowed collaborators" on public.collaborators
  for select using (public.can_access_representation(representation_id));
create policy "admins manage collaborators" on public.collaborators
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read allowed results" on public.monthly_results
  for select using (public.can_access_representation(representation_id));
create policy "admins manage results" on public.monthly_results
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read allowed collaborator results" on public.collaborator_results
  for select using (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id and public.can_access_representation(c.representation_id)
    )
  );
create policy "admins manage collaborator results" on public.collaborator_results
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read allowed expenses" on public.expenses
  for select using (public.can_access_representation(representation_id));
create policy "admins manage expenses" on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());
create policy "representatives create expenses" on public.expenses
  for insert with check (
    auth.uid() = created_by and public.can_access_representation(representation_id)
  );

create policy "users read allowed targets" on public.targets
  for select using (public.can_access_representation(representation_id));
create policy "admins manage targets" on public.targets
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public avatar reads" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "authenticated avatar uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
  with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
