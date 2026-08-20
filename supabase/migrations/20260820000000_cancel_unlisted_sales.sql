-- Permite cancelar vendas que foram lancadas diretamente no resultado mensal,
-- antes de o registro individual de vendas existir.
create or replace function public.cancel_unlisted_sale(
  sale_id uuid,
  target_representation_id uuid,
  target_collaborator_id uuid,
  sale_amount numeric,
  sale_half text,
  reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  result_record public.collaborator_results%rowtype;
  canonical_month date := date_trunc('month', current_date)::date;
begin
  if not public.can_access_representation(target_representation_id) then
    raise exception 'Sem permissao para cancelar esta venda.';
  end if;

  if not exists (
    select 1 from public.collaborators
    where id = target_collaborator_id
      and representation_id = target_representation_id
  ) then
    raise exception 'Colaborador nao pertence a representacao selecionada.';
  end if;

  if sale_amount <= 0 then
    raise exception 'O valor da venda deve ser maior que zero.';
  end if;
  if sale_half not in ('quinzena1', 'quinzena2') then
    raise exception 'Quinzena invalida.';
  end if;
  if length(trim(reason)) = 0 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into result_record
  from public.collaborator_results
  where collaborator_id = target_collaborator_id
    and month = canonical_month
  for update;

  if not found then
    raise exception 'Nao ha resultado mensal para este colaborador.';
  end if;
  if sale_half = 'quinzena1' and result_record.first_half < sale_amount then
    raise exception 'O valor informado e maior que o resultado da primeira quinzena.';
  end if;
  if sale_half = 'quinzena2' and result_record.second_half < sale_amount then
    raise exception 'O valor informado e maior que o resultado da segunda quinzena.';
  end if;

  insert into public.sales (
    id, representation_id, collaborator_id, amount, half, sold_at, status,
    cancellation_reason, cancelled_at, created_by
  ) values (
    sale_id, target_representation_id, target_collaborator_id, sale_amount,
    sale_half, now(), 'cancelada', trim(reason), now(), auth.uid()
  );

  update public.collaborator_results
  set first_half = case when sale_half = 'quinzena1' then first_half - sale_amount else first_half end,
      second_half = case when sale_half = 'quinzena2' then second_half - sale_amount else second_half end,
      quotas = greatest(0, quotas - 1),
      updated_at = now()
  where collaborator_id = target_collaborator_id
    and month = canonical_month;

  update public.collaborators
  set quotas = greatest(0, quotas - 1), updated_at = now()
  where id = target_collaborator_id;
end;
$$;
