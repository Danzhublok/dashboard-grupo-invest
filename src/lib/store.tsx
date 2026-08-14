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
  cancelarVenda: (saleId: string, motivo: string) => void;
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        if (active) setPronto(true);
        return;
      }

      setErro(null);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicioProximoMes = new Date(inicioMes);
      inicioProximoMes.setMonth(inicioProximoMes.getMonth() + 1);
      const mesAtual = inicioMes.toISOString().slice(0, 10);
      const proximoMes = inicioProximoMes.toISOString().slice(0, 10);

      const responses = await Promise.all([
        supabase.from("representations").select("id, name, logo_url, representative_name"),
        supabase
          .from("collaborators")
          .select("id, representation_id, full_name, role, avatar_url, quotas"),
        supabase
          .from("collaborator_results")
          .select("collaborator_id, first_half, second_half")
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
      const resultsByCollaborator = new Map<string, { first: number; second: number }>();
      (results ?? []).forEach((result) => {
        const previous = resultsByCollaborator.get(result.collaborator_id) ?? {
          first: 0,
          second: 0,
        };
        resultsByCollaborator.set(result.collaborator_id, {
          first: previous.first + Number(result.first_half ?? 0),
          second: previous.second + Number(result.second_half ?? 0),
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
              const result = resultsByCollaborator.get(collaborator.id) ?? { first: 0, second: 0 };
              return {
                id: collaborator.id,
                nome: collaborator.full_name,
                cargo: collaborator.role as Colaborador["cargo"],
                foto: collaborator.avatar_url ?? undefined,
                cotas: collaborator.quotas,
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
  }, [representationId, representationName, session?.userId]);

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
      pronto,
      erro,
      usuarios,
      setMeta: (v) => {
        setDados((d) => ({ ...d, metaMensal: v }));
        if (supabase) {
          void report(
            supabase.from("company_targets").upsert(
              {
                month: currentMonth(),
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
                month: currentMonth(),
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
                month: currentMonth(),
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
                quotas: patch.cotas === undefined ? undefined : Number(patch.cotas || 0),
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
                  month: currentMonth(),
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
      cancelarVenda: (saleId, motivo) => {
        const venda = dados.vendas.find((item) => item.id === saleId);
        if (!venda || venda.status === "cancelada") return;

        const motivoLimpo = motivo.trim();
        const canceladaEm = new Date().toISOString();
        const mesDaVenda = venda.data.slice(0, 10);
        const mesAtual = new Date().toISOString().slice(0, 7);
        const vendaNoMesAtual = mesDaVenda.slice(0, 7) === mesAtual;

        setDados((current) => ({
          ...current,
          vendas: current.vendas.map((item) =>
            item.id === saleId
              ? { ...item, status: "cancelada", motivoCancelamento: motivoLimpo, canceladaEm }
              : item,
          ),
          representacoes: vendaNoMesAtual
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

        if (supabase) {
          void report(supabase.rpc("cancel_sale", { sale_id: saleId, reason: motivoLimpo }));
        }
      },
      salvar: async () => {
        if (!supabase) return true;

        const month = currentMonth();
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
                  quotas: Number(collaborator.cotas || 0),
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
  }, [dados, dadosVisiveis, erro, pronto, session?.userId, usuarios]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de StoreProvider");
  return ctx;
}
