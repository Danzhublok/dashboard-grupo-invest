import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  dadosIniciais,
  type Colaborador,
  type DadosApp,
  type Representacao,
  type Saida,
  type UsuarioPainel,
} from "@/lib/reps";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Ctx = {
  dados: DadosApp;
  mesSelecionado: string;
  setMesSelecionado: (month: string) => void;
  pronto: boolean;
  erro: string | null;
  usuarios: UsuarioPainel[];
  setMeta: (v: number) => void;
  setMetaEquipe: (representationId: string, value: number) => void;
  setMetaColaborador: (collaboratorId: string, value: number) => void;
  addRepresentacao: (
    r: Omit<Representacao, "colaboradores">,
  ) => Promise<RepresentativeCredentials | null>;
  criarUsuario: (
    representationId: string,
    username: string,
    password: string,
  ) => Promise<RepresentativeCredentials | null>;
  updateRepresentacao: (id: string, patch: Partial<Representacao>) => void;
  removeRepresentacao: (id: string) => void;
  addColaborador: (repId: string, c: Colaborador) => void;
  updateColaborador: (repId: string, colId: string, patch: Partial<Colaborador>) => void;
  removeColaborador: (repId: string, colId: string) => void;
  addSaida: (saida: Saida) => void;
  removeSaida: (id: string) => void;
  registrarVenda: (input: {
    representationId: string;
    collaboratorId: string;
    valor: number;
    quinzena: "quinzena1" | "quinzena2";
  }) => void;
  importarVendas: (input: {
    sales: Array<{
      row: number;
      date: string;
      representationId: string;
      collaboratorId: string;
      amount: number;
      status: "ativa" | "cancelada";
    }>;
  }) => Promise<boolean>;
  cancelarVenda: (saleId: string, motivo: string) => Promise<boolean>;
  revogarCancelamento: (saleId: string) => void;
  cancelarVendaNaoListada: (input: {
    representationId: string;
    collaboratorId: string;
    valor: number;
    quinzena: "quinzena1" | "quinzena2";
    motivo: string;
  }) => void;
  salvar: () => Promise<boolean>;
  resetar: () => void;
  deleteUsuario: (userId: string) => Promise<boolean>;
  alterarSenhaUsuario: (userId: string, password: string) => Promise<boolean>;
};

export type RepresentativeCredentials = {
  username: string;
  password: string;
};

const StoreContext = createContext<Ctx | null>(null);

// Monthly records always share one key, regardless of the day they are edited.
const currentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
};

const monthKey = (month: string) => `${month}-01`;

export function StoreProvider({
  children,
  representationId,
  representationName,
}: {
  children: ReactNode;
  representationId?: string;
  representationName?: string;
}) {
  const { session } = useAuth();
  const [dados, setDados] = useState<DadosApp>(dadosIniciais);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().toISOString().slice(0, 7));
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        if (active) setPronto(true);
        return;
      }

      setErro(null);
      const inicioMes = new Date(`${mesSelecionado}-01T12:00:00`);
      const inicioProximoMes = new Date(inicioMes);
      inicioProximoMes.setMonth(inicioProximoMes.getMonth() + 1);
      const mesAtual = monthKey(mesSelecionado);
      const proximoMes = `${inicioProximoMes.getFullYear()}-${String(inicioProximoMes.getMonth() + 1).padStart(2, "0")}-01`;

      const responses = await Promise.all([
        supabase.from("representations").select("id, name, logo_url, representative_name"),
        supabase
          .from("collaborators")
          .select("id, representation_id, full_name, role, avatar_url, quotas"),
        supabase
          .from("collaborator_results")
          .select("collaborator_id, month, first_half, second_half, quotas")
          .gte("month", mesAtual)
          .lt("month", proximoMes),
        supabase.from("expenses").select("id, representation_id, reason, amount, occurred_on"),
        supabase
          .from("targets")
          .select("representation_id, amount")
          .gte("month", mesAtual)
          .lt("month", proximoMes)
          .order("month", { ascending: false }),
        supabase.from("profiles").select("id, full_name, username, role"),
        supabase
          .from("representation_members")
          .select("user_id, representation_id, representation:representations(name)"),
        supabase
          .from("collaborator_targets")
          .select("collaborator_id, amount")
          .gte("month", mesAtual)
          .lt("month", proximoMes),
        supabase
          .from("company_targets")
          .select("amount")
          .gte("month", mesAtual)
          .lt("month", proximoMes)
          .limit(1),
        supabase
          .from("sales")
          .select(
            "id, representation_id, collaborator_id, amount, half, sold_at, status, cancellation_reason, cancelled_at",
          )
          .gte("sold_at", `${mesAtual}T00:00:00-03:00`)
          .lt("sold_at", `${proximoMes}T00:00:00-03:00`)
          .order("sold_at", { ascending: false }),
      ]);

      const failed = responses.find((response) => response.error);
      if (failed) {
        if (active) {
          setErro(failed.error?.message ?? "Não foi possível carregar os dados do Supabase.");
          setPronto(true);
        }
        return;
      }

      const [
        { data: reps },
        { data: collaborators },
        { data: results },
        { data: expenses },
        { data: targets },
        { data: profiles },
        { data: memberships },
        { data: collaboratorTargets },
        { data: companyTargets },
        { data: sales },
      ] = responses;

      if (!active) return;
      const resultsByCollaborator = new Map<
        string,
        { first: number; second: number; quotas: number }
      >();
      const collaboratorsWithCanonicalResult = new Set<string>();
      (results ?? []).forEach((result) => {
        // New writes use the first day as the canonical monthly record. When
        // legacy daily rows also exist, the canonical row is the final value
        // and must not be added to them.
        if (result.month === mesAtual) {
          resultsByCollaborator.set(result.collaborator_id, {
            first: Number(result.first_half ?? 0),
            second: Number(result.second_half ?? 0),
            quotas: Number(result.quotas ?? 0),
          });
          collaboratorsWithCanonicalResult.add(result.collaborator_id);
          return;
        }

        if (collaboratorsWithCanonicalResult.has(result.collaborator_id)) return;
        const previous = resultsByCollaborator.get(result.collaborator_id) ?? {
          first: 0,
          second: 0,
          quotas: 0,
        };
        resultsByCollaborator.set(result.collaborator_id, {
          first: previous.first + Number(result.first_half ?? 0),
          second: previous.second + Number(result.second_half ?? 0),
          quotas: previous.quotas + Number(result.quotas ?? 0),
        });
      });

      const metasEquipe = Object.fromEntries(
        (targets ?? []).map((target) => [target.representation_id, Number(target.amount ?? 0)]),
      );
      const metasColaborador = Object.fromEntries(
        (collaboratorTargets ?? []).map((target) => [
          target.collaborator_id,
          Number(target.amount ?? 0),
        ]),
      );
      setUsuarios(
        (profiles ?? []).map((profile) => {
          const membership = (memberships ?? []).find((item) => item.user_id === profile.id);
          const representation = membership?.representation as unknown as { name?: string } | null;
          return {
            id: profile.id,
            nome: profile.full_name,
            username: profile.username ?? undefined,
            role: profile.role,
            representationId: membership?.representation_id,
            representationName: representation?.name,
          };
        }),
      );
      const visibleRepresentation = (reps ?? []).find(
        (representation) =>
          representation.id === representationId || representation.name === representationName,
      );
      setDados((atual) => ({
        vendas: atual.vendas ?? [],
        metaMensal: Number(companyTargets?.[0]?.amount ?? 0),
        metasEquipe,
        metasColaborador,
        vendas: (sales ?? []).map((sale) => ({
          id: sale.id,
          representationId: sale.representation_id,
          collaboratorId: sale.collaborator_id,
          valor: Number(sale.amount),
          quinzena: sale.half as "quinzena1" | "quinzena2",
          data: sale.sold_at,
          status: sale.status as "ativa" | "cancelada",
          motivoCancelamento: sale.cancellation_reason ?? undefined,
          canceladaEm: sale.cancelled_at ?? undefined,
        })),
        saidas: (expenses ?? []).map((expense) => ({
          id: expense.id,
          motivo: expense.reason,
          valor: Number(expense.amount),
          data: expense.occurred_on,
        })),
        representacoes: (reps ?? []).map((rep) => ({
          id: rep.id,
          nome: rep.name,
          logo: rep.logo_url ?? "",
          representante: rep.representative_name ?? "A definir",
          colaboradores: (collaborators ?? [])
            .filter((collaborator) => collaborator.representation_id === rep.id)
            .map((collaborator) => {
              const result = resultsByCollaborator.get(collaborator.id) ?? {
                first: 0,
                second: 0,
                quotas: 0,
              };
              return {
                id: collaborator.id,
                nome: collaborator.full_name,
                cargo: collaborator.role as Colaborador["cargo"],
                foto: collaborator.avatar_url ?? undefined,
                cotas: result.quotas,
                quinzena1: result.first,
                quinzena2: result.second,
              };
            }),
        })),
      }));
      setPronto(true);
    };
    void load();
    return () => {
      active = false;
    };
  }, [mesSelecionado, reloadToken, representationId, representationName, session?.userId]);

  const dadosVisiveis = useMemo(
    () =>
      representationId
        ? {
            ...dados,
            representacoes: dados.representacoes.filter(
              (rep) => rep.id === representationId || rep.nome === representationName,
            ),
          }
        : dados,
    [dados, representationId, representationName],
  );

  const value = useMemo<Ctx>(() => {
    const mapReps = (fn: (r: Representacao) => Representacao) =>
      setDados((d) => ({ ...d, representacoes: d.representacoes.map(fn) }));
    const report = async (operation: PromiseLike<{ error: { message: string } | null }>) => {
      const result = await operation;
      if (result.error) setErro(result.error.message);
    };

    return {
      dados: dadosVisiveis,
      mesSelecionado,
      setMesSelecionado,
      pronto,
      erro,
      usuarios,
      setMeta: (v) => {
        setDados((d) => ({ ...d, metaMensal: v }));
        if (supabase) {
          void report(
            supabase.from("company_targets").upsert(
              {
                month: monthKey(mesSelecionado),
                amount: v,
              },
              { onConflict: "month" },
            ),
          );
        }
      },
      setMetaEquipe: (representationId, value) => {
        setDados((current) => ({
          ...current,
          metasEquipe: { ...current.metasEquipe, [representationId]: value },
        }));
        if (supabase)
          void report(
            supabase.from("targets").upsert(
              {
                representation_id: representationId,
                month: monthKey(mesSelecionado),
                amount: value,
              },
              { onConflict: "representation_id,month" },
            ),
          );
      },
      setMetaColaborador: (collaboratorId, value) => {
        setDados((current) => ({
          ...current,
          metasColaborador: { ...current.metasColaborador, [collaboratorId]: value },
        }));
        if (supabase)
          void report(
            supabase.from("collaborator_targets").upsert(
              {
                collaborator_id: collaboratorId,
                month: monthKey(mesSelecionado),
                amount: value,
              },
              { onConflict: "collaborator_id,month" },
            ),
          );
      },
      addRepresentacao: async (r) => {
        const id = r.id;
        setDados((d) => ({
          ...d,
          representacoes: [...d.representacoes, { ...r, id, colaboradores: [] }],
        }));
        if (!supabase) return null;

        const { error: insertError } = await supabase.from("representations").insert({
          id,
          name: r.nome,
          logo_url: r.logo,
          representative_name: r.representante,
        });
        if (insertError) {
          setErro(insertError.message);
          return null;
        }

        return null;
      },
      criarUsuario: async (representationId, username, password) => {
        if (!supabase) return null;
        const representation = dadosVisiveis.representacoes.find(
          (item) => item.id === representationId,
        );
        if (!representation) {
          setErro("Representação não encontrada.");
          return null;
        }

        const { data, error } = await supabase.functions.invoke("create-representative-account", {
          body: {
            representation_id: representation.id,
            representation_name: representation.nome,
            username,
            password,
          },
        });
        if (error) {
          let message = error.message;
          const context = "context" in error ? error.context : undefined;
          if (context instanceof Response) {
            try {
              const body = (await context.clone().json()) as { error?: string };
              message = body.error ?? message;
            } catch {
              // Mantém a mensagem padrão quando a função não retorna JSON.
            }
          }
          if (message.toLowerCase().includes("failed to send")) {
            message = `${message}. Publique a Edge Function com: supabase functions deploy create-representative-account`;
          }
          setErro(message);
          return null;
        }
        return data as RepresentativeCredentials;
      },
      deleteUsuario: async (userId) => {
        if (!supabase) return false;
        const { error } = await supabase.rpc("delete_representative_account", {
          target_user_id: userId,
        });
        if (error) {
          setErro(error.message);
          return false;
        }
        setUsuarios((current) => current.filter((user) => user.id !== userId));
        return true;
      },
      alterarSenhaUsuario: async (userId, password) => {
        if (!supabase) return false;
        const { error } = await supabase.functions.invoke("update-representative-password", {
          body: { target_user_id: userId, password },
        });
        if (error) {
          let message = error.message;
          const context = "context" in error ? error.context : undefined;
          if (context instanceof Response) {
            try {
              const body = (await context.clone().json()) as { error?: string };
              message = body.error ?? message;
            } catch {
              // Mantém a mensagem padrão quando a função não retorna JSON.
            }
          }
          setErro(message);
          return false;
        }
        return true;
      },
      updateRepresentacao: (id, patch) => {
        mapReps((r) => (r.id === id ? { ...r, ...patch } : r));
        if (supabase)
          void report(
            supabase
              .from("representations")
              .update({
                name: patch.nome,
                logo_url: patch.logo,
                representative_name: patch.representante,
              })
              .eq("id", id),
          );
      },
      removeRepresentacao: (id) => {
        setDados((d) => ({
          ...d,
          representacoes: d.representacoes.filter((r) => r.id !== id),
        }));
        if (supabase) void report(supabase.from("representations").delete().eq("id", id));
      },
      addColaborador: (repId, c) => {
        mapReps((r) => (r.id === repId ? { ...r, colaboradores: [...r.colaboradores, c] } : r));
        if (supabase)
          void report(
            supabase.from("collaborators").insert({
              id: c.id,
              representation_id: repId,
              full_name: c.nome,
              role: c.cargo,
              avatar_url: c.foto,
              quotas: Number(c.cotas || 0),
            }),
          );
      },
      updateColaborador: (repId, colId, patch) => {
        mapReps((r) =>
          r.id === repId
            ? {
                ...r,
                colaboradores: r.colaboradores.map((c) =>
                  c.id === colId ? { ...c, ...patch } : c,
                ),
              }
            : r,
        );
        if (supabase) {
          void report(
            supabase
              .from("collaborators")
              .update({
                full_name: patch.nome,
                role: patch.cargo,
                avatar_url: patch.foto,
              })
              .eq("id", colId),
          );
          const current = dadosVisiveis.representacoes
            .flatMap((representation) => representation.colaboradores)
            .find((collaborator) => collaborator.id === colId);
          if (current) {
            const next = { ...current, ...patch };
            void report(
              supabase.from("collaborator_results").upsert(
                {
                  collaborator_id: colId,
                  month: monthKey(mesSelecionado),
                  first_half: Number(next.quinzena1 || 0),
                  second_half: Number(next.quinzena2 || 0),
                  quotas: Number(next.cotas || 0),
                },
                { onConflict: "collaborator_id,month" },
              ),
            );
          }
        }
      },
      removeColaborador: (repId, colId) => {
        mapReps((r) =>
          r.id === repId
            ? { ...r, colaboradores: r.colaboradores.filter((c) => c.id !== colId) }
            : r,
        );
        if (supabase) void report(supabase.from("collaborators").delete().eq("id", colId));
      },
      addSaida: (saida) => {
        setDados((d) => ({ ...d, saidas: [...d.saidas, saida] }));
        if (supabase && session?.userId && dadosVisiveis.representacoes[0])
          void report(
            supabase.from("expenses").insert({
              id: saida.id,
              representation_id: dadosVisiveis.representacoes[0].id,
              reason: saida.motivo,
              amount: saida.valor,
              occurred_on: saida.data,
              created_by: session.userId,
            }),
          );
      },
      removeSaida: (id) => {
        setDados((d) => ({ ...d, saidas: d.saidas.filter((s) => s.id !== id) }));
        if (supabase) void report(supabase.from("expenses").delete().eq("id", id));
      },
      registrarVenda: ({ representationId, collaboratorId, valor, quinzena }) => {
        const month = currentMonth();

        const vendaId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        const sale: import("@/lib/reps").Venda = {
          id: vendaId,
          representationId,
          collaboratorId,
          valor,
          quinzena,
          data: new Date().toISOString(),
          status: "ativa",
        };

        setDados((current) => ({
          ...current,
          vendas: [sale, ...current.vendas],
          representacoes: current.representacoes.map((rep) => {
            if (rep.id !== representationId) return rep;

            return {
              ...rep,
              colaboradores: rep.colaboradores.map((collaborator) => {
                if (collaborator.id !== collaboratorId) return collaborator;

                const proximoValor = Number(valor);
                const atualQuinzena1 = Number(collaborator.quinzena1 || 0);
                const atualQuinzena2 = Number(collaborator.quinzena2 || 0);
                const atualCotas = Number(collaborator.cotas || 0);

                return {
                  ...collaborator,
                  cotas: atualCotas + 1,
                  quinzena1:
                    quinzena === "quinzena1" ? atualQuinzena1 + proximoValor : atualQuinzena1,
                  quinzena2:
                    quinzena === "quinzena2" ? atualQuinzena2 + proximoValor : atualQuinzena2,
                };
              }),
            };
          }),
        }));

        if (supabase) {
          const target = dadosVisiveis.representacoes
            .flatMap((rep) => rep.colaboradores)
            .find((c) => c.id === collaboratorId);

          if (target) {
            const updatedQuinzena1 =
              quinzena === "quinzena1"
                ? Number(target.quinzena1 || 0) + Number(valor)
                : Number(target.quinzena1 || 0);
            const updatedQuinzena2 =
              quinzena === "quinzena2"
                ? Number(target.quinzena2 || 0) + Number(valor)
                : Number(target.quinzena2 || 0);
            const updatedCotas = Number(target.cotas || 0) + 1;

            void report(
              supabase.from("sales").insert({
                id: vendaId,
                representation_id: representationId,
                collaborator_id: collaboratorId,
                amount: valor,
                half: quinzena,
                sold_at: sale.data,
                created_by: session?.userId ?? null,
              }),
            );

            void report(
              supabase.from("collaborator_results").upsert(
                {
                  collaborator_id: collaboratorId,
                  month,
                  first_half: updatedQuinzena1,
                  second_half: updatedQuinzena2,
                  quotas: updatedCotas,
                },
                { onConflict: "collaborator_id,month" },
              ),
            );

            void report(
              supabase
                .from("collaborators")
                .update({ quotas: updatedCotas })
                .eq("id", collaboratorId),
            );
          }
        }
      },
      importarVendas: async ({ sales }) => {
        if (!supabase) {
          setErro("A importação exige conexão com o banco de dados.");
          return false;
        }
        const { error } = await supabase.rpc("replace_sales_import_batch_v2", {
          imported_sales: sales,
        });
        if (
          error &&
          !/replace_sales_import_batch_v2|schema cache|could not find/i.test(error.message)
        ) {
          setErro(error.message);
          return false;
        }
        if (error) {
          const periods = [
            ...new Map(
              sales.map((sale) => {
                const month = sale.date.slice(0, 7);
                const half = Number(sale.date.slice(8, 10)) <= 14 ? "quinzena1" : "quinzena2";
                return [`${month}-${half}`, { month, half }] as const;
              }),
            ).values(),
          ];
          const cancelledIds: string[] = [];
          const previousCancelled: Array<{
            id: string;
            cancellation_reason: string | null;
            cancelled_at: string | null;
          }> = [];
          for (const period of periods) {
            const startDay = period.half === "quinzena1" ? "01" : "15";
            const endDay = period.half === "quinzena1" ? "15" : "32";
            const start = `${period.month}-${startDay}T00:00:00-03:00`;
            const monthDate = new Date(`${period.month}-01T12:00:00`);
            const followingMonth = new Date(monthDate);
            followingMonth.setMonth(followingMonth.getMonth() + 1);
            const end =
              endDay === "15"
                ? `${period.month}-15T00:00:00-03:00`
                : `${followingMonth.getFullYear()}-${String(followingMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`;
            const existing = await supabase
              .from("sales")
              .select("id, status, cancellation_reason, cancelled_at")
              .gte("sold_at", start)
              .lt("sold_at", end)
              .eq("half", period.half);
            if (existing.error) {
              setErro(existing.error.message);
              return false;
            }
            const ids = (existing.data ?? []).map((sale) => sale.id);
            cancelledIds.push(
              ...(existing.data ?? [])
                .filter((sale) => sale.status === "ativa")
                .map((sale) => sale.id),
            );
            previousCancelled.push(
              ...(existing.data ?? [])
                .filter((sale) => sale.status === "cancelada")
                .map((sale) => ({
                  id: sale.id,
                  cancellation_reason: sale.cancellation_reason,
                  cancelled_at: sale.cancelled_at,
                })),
            );
            if (ids.length) {
              const cancelledAt = new Date().toISOString();
              const cancellation = await supabase
                .from("sales")
                .update({
                  status: "cancelada",
                  cancellation_reason: "Substituída por nova importação",
                  cancelled_at: cancelledAt,
                })
                .in("id", ids);
              if (cancellation.error) {
                setErro(cancellation.error.message);
                return false;
              }
            }
          }

          const inserted = await supabase.from("sales").insert(
            sales.map((sale) => ({
              representation_id: sale.representationId,
              collaborator_id: sale.collaboratorId,
              amount: sale.amount,
              half: Number(sale.date.slice(8, 10)) <= 14 ? "quinzena1" : "quinzena2",
              sold_at: `${sale.date}T12:00:00-03:00`,
              status: sale.status,
              cancellation_reason:
                sale.status === "cancelada" ? "Venda cancelada - marcada em vermelho" : null,
              cancelled_at: sale.status === "cancelada" ? new Date().toISOString() : null,
              created_by: session?.userId ?? null,
            })),
          );
          if (inserted.error) {
            if (cancelledIds.length) {
              await supabase
                .from("sales")
                .update({ status: "ativa", cancellation_reason: null, cancelled_at: null })
                .in("id", cancelledIds);
            }
            await Promise.all(
              previousCancelled.map((sale) =>
                supabase
                  .from("sales")
                  .update({
                    status: "cancelada",
                    cancellation_reason: sale.cancellation_reason,
                    cancelled_at: sale.cancelled_at,
                  })
                  .eq("id", sale.id),
              ),
            );
            setErro(inserted.error.message);
            return false;
          }

          const months = [...new Set(sales.map((sale) => sale.date.slice(0, 7)))];
          for (const month of months) {
            const monthDate = new Date(`${month}-01T12:00:00`);
            monthDate.setMonth(monthDate.getMonth() + 1);
            const nextMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;
            const activeSales = await supabase
              .from("sales")
              .select("collaborator_id, amount, half")
              .gte("sold_at", `${month}-01T00:00:00-03:00`)
              .lt("sold_at", `${nextMonth}T00:00:00-03:00`)
              .eq("status", "ativa");
            if (activeSales.error) {
              setErro(activeSales.error.message);
              return false;
            }
            const totals = new Map<string, { first: number; second: number; quotas: number }>();
            for (const sale of activeSales.data ?? []) {
              const total = totals.get(sale.collaborator_id) ?? { first: 0, second: 0, quotas: 0 };
              if (sale.half === "quinzena1") total.first += Number(sale.amount);
              else total.second += Number(sale.amount);
              total.quotas += 1;
              totals.set(sale.collaborator_id, total);
            }
            const results = dadosVisiveis.representacoes.flatMap((rep) =>
              rep.colaboradores.map((collaborator) => {
                const total = totals.get(collaborator.id) ?? { first: 0, second: 0, quotas: 0 };
                return {
                  collaborator_id: collaborator.id,
                  month: `${month}-01`,
                  first_half: total.first,
                  second_half: total.second,
                  quotas: total.quotas,
                };
              }),
            );
            const recalculated = await supabase
              .from("collaborator_results")
              .upsert(results, { onConflict: "collaborator_id,month" });
            if (recalculated.error) {
              setErro(recalculated.error.message);
              return false;
            }
          }
        }
        setErro(null);
        const month = sales[0]?.date.slice(0, 7);
        if (month && month !== mesSelecionado) setMesSelecionado(month);
        else setReloadToken((value) => value + 1);
        return true;
      },
      cancelarVenda: async (saleId, motivo) => {
        const venda = dados.vendas.find((item) => item.id === saleId);
        if (!venda || venda.status === "cancelada") return false;

        const motivoLimpo = motivo.trim();
        const canceladaEm = new Date().toISOString();
        const vendaNoMesSelecionado = venda.data.slice(0, 7) === mesSelecionado;

        if (supabase) {
          const { error } = await supabase.rpc("cancel_sale", {
            sale_id: saleId,
            reason: motivoLimpo,
          });
          if (error) {
            setErro(error.message);
            return false;
          }
        }

        setDados((current) => ({
          ...current,
          vendas: current.vendas.map((item) =>
            item.id === saleId
              ? { ...item, status: "cancelada", motivoCancelamento: motivoLimpo, canceladaEm }
              : item,
          ),
          representacoes: vendaNoMesSelecionado
            ? current.representacoes.map((rep) =>
                rep.id !== venda.representationId
                  ? rep
                  : {
                      ...rep,
                      colaboradores: rep.colaboradores.map((collaborator) =>
                        collaborator.id !== venda.collaboratorId
                          ? collaborator
                          : {
                              ...collaborator,
                              cotas: Math.max(0, Number(collaborator.cotas || 0) - 1),
                              quinzena1:
                                venda.quinzena === "quinzena1"
                                  ? Math.max(0, Number(collaborator.quinzena1 || 0) - venda.valor)
                                  : collaborator.quinzena1,
                              quinzena2:
                                venda.quinzena === "quinzena2"
                                  ? Math.max(0, Number(collaborator.quinzena2 || 0) - venda.valor)
                                  : collaborator.quinzena2,
                            },
                      ),
                    },
              )
            : current.representacoes,
        }));
        setErro(null);
        return true;
      },
      revogarCancelamento: (saleId) => {
        const venda = dados.vendas.find((item) => item.id === saleId);
        if (!venda || venda.status !== "cancelada") return;

        const vendaNoMesSelecionado = venda.data.slice(0, 7) === mesSelecionado;

        setDados((current) => ({
          ...current,
          vendas: current.vendas.map((item) =>
            item.id === saleId
              ? {
                  ...item,
                  status: "ativa",
                  motivoCancelamento: undefined,
                  canceladaEm: undefined,
                }
              : item,
          ),
          representacoes: vendaNoMesSelecionado
            ? current.representacoes.map((rep) =>
                rep.id !== venda.representationId
                  ? rep
                  : {
                      ...rep,
                      colaboradores: rep.colaboradores.map((collaborator) =>
                        collaborator.id !== venda.collaboratorId
                          ? collaborator
                          : {
                              ...collaborator,
                              cotas: Number(collaborator.cotas || 0) + 1,
                              quinzena1:
                                venda.quinzena === "quinzena1"
                                  ? Number(collaborator.quinzena1 || 0) + venda.valor
                                  : collaborator.quinzena1,
                              quinzena2:
                                venda.quinzena === "quinzena2"
                                  ? Number(collaborator.quinzena2 || 0) + venda.valor
                                  : collaborator.quinzena2,
                            },
                      ),
                    },
              )
            : current.representacoes,
        }));

        if (supabase) {
          void report(supabase.rpc("revoke_sale_cancellation", { sale_id: saleId }));
        }
      },
      cancelarVendaNaoListada: ({ representationId, collaboratorId, valor, quinzena, motivo }) => {
        const motivoLimpo = motivo.trim();
        const vendaId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        const agora = new Date().toISOString();
        if (!motivoLimpo || valor <= 0) return;

        setDados((current) => ({
          ...current,
          vendas: [
            {
              id: vendaId,
              representationId,
              collaboratorId,
              valor,
              quinzena,
              data: agora,
              status: "cancelada",
              motivoCancelamento: motivoLimpo,
              canceladaEm: agora,
            },
            ...current.vendas,
          ],
          representacoes: current.representacoes.map((rep) =>
            rep.id !== representationId
              ? rep
              : {
                  ...rep,
                  colaboradores: rep.colaboradores.map((collaborator) =>
                    collaborator.id !== collaboratorId
                      ? collaborator
                      : {
                          ...collaborator,
                          cotas: Math.max(0, Number(collaborator.cotas || 0) - 1),
                          quinzena1:
                            quinzena === "quinzena1"
                              ? Math.max(0, Number(collaborator.quinzena1 || 0) - valor)
                              : collaborator.quinzena1,
                          quinzena2:
                            quinzena === "quinzena2"
                              ? Math.max(0, Number(collaborator.quinzena2 || 0) - valor)
                              : collaborator.quinzena2,
                        },
                  ),
                },
          ),
        }));

        if (supabase) {
          void report(
            supabase.rpc("cancel_unlisted_sale", {
              sale_id: vendaId,
              target_representation_id: representationId,
              target_collaborator_id: collaboratorId,
              sale_amount: valor,
              sale_half: quinzena,
              reason: motivoLimpo,
            }),
          );
        }
      },
      salvar: async () => {
        if (!supabase) return true;

        const month = monthKey(mesSelecionado);
        const operations = [
          supabase
            .from("company_targets")
            .upsert(
              { month, amount: Number(dadosVisiveis.metaMensal || 0) },
              { onConflict: "month" },
            ),
          ...Object.entries(dadosVisiveis.metasEquipe).map(([representationId, amount]) =>
            supabase
              .from("targets")
              .upsert(
                { representation_id: representationId, month, amount: Number(amount || 0) },
                { onConflict: "representation_id,month" },
              ),
          ),
          ...Object.entries(dadosVisiveis.metasColaborador).map(([collaboratorId, amount]) =>
            supabase
              .from("collaborator_targets")
              .upsert(
                { collaborator_id: collaboratorId, month, amount: Number(amount || 0) },
                { onConflict: "collaborator_id,month" },
              ),
          ),
          ...dadosVisiveis.representacoes.flatMap((representation) => [
            supabase
              .from("representations")
              .update({
                name: representation.nome,
                logo_url: representation.logo,
                representative_name: representation.representante,
              })
              .eq("id", representation.id),
            ...representation.colaboradores.map((collaborator) =>
              supabase
                .from("collaborators")
                .update({
                  full_name: collaborator.nome,
                  role: collaborator.cargo,
                  avatar_url: collaborator.foto,
                })
                .eq("id", collaborator.id),
            ),
            ...representation.colaboradores.map((collaborator) =>
              supabase.from("collaborator_results").upsert(
                {
                  collaborator_id: collaborator.id,
                  month,
                  first_half: Number(collaborator.quinzena1 || 0),
                  second_half: Number(collaborator.quinzena2 || 0),
                  quotas: Number(collaborator.cotas || 0),
                },
                { onConflict: "collaborator_id,month" },
              ),
            ),
          ]),
        ];
        const results = await Promise.all(operations);
        const failed = results.find((result) => result.error);
        if (failed?.error) {
          setErro(failed.error.message);
          return false;
        }

        setErro(null);
        return true;
      },
      resetar: () => setDados(dadosIniciais),
    };
  }, [dados, dadosVisiveis, erro, mesSelecionado, pronto, session?.userId, usuarios]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de StoreProvider");
  return ctx;
}
