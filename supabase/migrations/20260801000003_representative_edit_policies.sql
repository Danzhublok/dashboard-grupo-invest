create policy "representatives manage own collaborators" on public.collaborators
  for all using (public.can_access_representation(representation_id))
  with check (public.can_access_representation(representation_id));

create policy "representatives update own logo" on public.representations
  for update using (public.can_access_representation(id))
  with check (public.can_access_representation(id));

create policy "representatives manage own team targets" on public.targets
  for all using (public.can_access_representation(representation_id))
  with check (public.can_access_representation(representation_id));

create or replace function public.protect_representation_identity()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.name := old.name;
    new.representative_name := old.representative_name;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_representation_identity on public.representations;
create trigger protect_representation_identity
before update on public.representations
for each row execute procedure public.protect_representation_identity();
