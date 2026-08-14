-- Limpa os dados operacionais, preservando representações, colaboradores e acessos.
truncate table
  public.sales,
  public.monthly_results,
  public.collaborator_results,
  public.expenses,
  public.targets,
  public.collaborator_targets,
  public.company_targets;

-- As cotas também são dados operacionais e devem voltar a zero.
update public.collaborators
set quotas = 0, updated_at = now();
