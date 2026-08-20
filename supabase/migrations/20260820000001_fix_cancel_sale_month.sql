-- Corrige cancelamentos de vendas: os resultados mensais usam sempre o
-- primeiro dia do mes, e nao o dia em que a venda aconteceu.
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
    raise exception 'Venda nao encontrada.';
  end if;
  if not public.can_access_representation(sale_record.representation_id) then
    raise exception 'Sem permissao para cancelar esta venda.';
  end if;
  if sale_record.status = 'cancelada' then
    raise exception 'Esta venda ja foi cancelada.';
  end if;
  if length(trim(reason)) = 0 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  sale_month := date_trunc('month', sale_record.sold_at)::date;

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

-- Repara cancelamentos feitos pela funcao antiga. Vendas importadas ja
-- canceladas e cancelamentos manuais nao listados ficam fora deste ajuste.
with broken_cancellations as (
  select
    collaborator_id,
    date_trunc('month', sold_at)::date as month,
    sum(amount) filter (where half = 'quinzena1') as first_half_amount,
    sum(amount) filter (where half = 'quinzena2') as second_half_amount,
    count(*)::integer as quota_count
  from public.sales
  where status = 'cancelada'
    and cancelled_at > sold_at + interval '1 minute'
    and sold_at::date <> date_trunc('month', sold_at)::date
    and cancellation_reason not ilike '%marcada em vermelho%'
  group by collaborator_id, date_trunc('month', sold_at)::date
)
update public.collaborator_results as result
set first_half = greatest(0, result.first_half - coalesce(cancelled.first_half_amount, 0)),
    second_half = greatest(0, result.second_half - coalesce(cancelled.second_half_amount, 0)),
    quotas = greatest(0, result.quotas - cancelled.quota_count),
    updated_at = now()
from broken_cancellations as cancelled
where result.collaborator_id = cancelled.collaborator_id
  and result.month = cancelled.month;

with broken_cancellations as (
  select collaborator_id, count(*)::integer as quota_count
  from public.sales
  where status = 'cancelada'
    and cancelled_at > sold_at + interval '1 minute'
    and sold_at::date <> date_trunc('month', sold_at)::date
    and cancellation_reason not ilike '%marcada em vermelho%'
  group by collaborator_id
)
update public.collaborators as collaborator
set quotas = greatest(0, collaborator.quotas - cancelled.quota_count),
    updated_at = now()
from broken_cancellations as cancelled
where collaborator.id = cancelled.collaborator_id;
