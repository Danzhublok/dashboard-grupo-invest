create table if not exists public.company_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_targets enable row level security;
create policy "users read company targets" on public.company_targets
  for select using (auth.uid() is not null);
create policy "admins manage company targets" on public.company_targets
  for all using (public.is_admin()) with check (public.is_admin());
