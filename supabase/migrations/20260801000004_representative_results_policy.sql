create policy "representatives manage own collaborator results" on public.collaborator_results
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
