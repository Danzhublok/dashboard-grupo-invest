import { createFileRoute } from "@tanstack/react-router";
import { Ban, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, type Venda } from "@/lib/reps";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/cancelamentos")({ component: CancelamentosPage });

function CancelamentosPage() {
  const { dados, cancelarVenda, cancelarVendaNaoListada, revogarCancelamento } = useStore();
  const [modalAberto, setModalAberto] = useState(false);
  const [representacaoId, setRepresentacaoId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [vendaId, setVendaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [valorNaoListado, setValorNaoListado] = useState("");
  const [quinzenaNaoListada, setQuinzenaNaoListada] = useState<"quinzena1" | "quinzena2">(
    "quinzena1",
  );

  const vendasAtivas = useMemo(
    () => dados.vendas.filter((venda) => venda.status === "ativa"),
    [dados.vendas],
  );
  const vendasCanceladas = useMemo(
    () => dados.vendas.filter((venda) => venda.status === "cancelada"),
    [dados.vendas],
  );
  const colaboradores = useMemo(
    () => dados.representacoes.find((rep) => rep.id === representacaoId)?.colaboradores ?? [],
    [dados.representacoes, representacaoId],
  );
  const vendasDoColaborador = useMemo(
    () =>
      vendasAtivas.filter(
        (venda) =>
          venda.representationId === representacaoId && venda.collaboratorId === colaboradorId,
      ),
    [colaboradorId, representacaoId, vendasAtivas],
  );

  const detalhes = (venda: Venda) => {
    const rep = dados.representacoes.find((item) => item.id === venda.representationId);
    const colaborador = rep?.colaboradores.find((item) => item.id === venda.collaboratorId);
    const data = new Date(venda.data);
    return {
      representacao: rep?.nome ?? "Representação",
      colaborador: colaborador?.nome ?? "Colaborador",
      data: Number.isNaN(data.getTime()) ? "Data indisponível" : data.toLocaleDateString("pt-BR"),
    };
  };

  const abrirModal = () => {
    setRepresentacaoId("");
    setColaboradorId("");
    setVendaId("");
    setMotivo("");
    setValorNaoListado("");
    setQuinzenaNaoListada("quinzena1");
    setModalAberto(true);
  };

  const confirmar = () => {
    if (!vendaId || !motivo.trim()) return;
    if (vendaId === "nao-listada") {
      const valor = Number(valorNaoListado);
      if (!representacaoId || !colaboradorId || !valor || valor <= 0) return;
      cancelarVendaNaoListada({
        representationId: representacaoId,
        collaboratorId: colaboradorId,
        valor,
        quinzena: quinzenaNaoListada,
        motivo,
      });
      setModalAberto(false);
      return;
    }
    cancelarVenda(vendaId, motivo);
    setModalAberto(false);
  };

  return (
    <AppLayout title="Cancelamentos">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Controle de vendas
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Cancelamento de vendas</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Registre uma venda que caiu ou foi cancelada. O histórico será preservado.
            </p>
          </div>
          <Button className="gap-2" onClick={abrirModal}>
            <Plus className="size-4" />
            Cancelar venda
          </Button>
        </section>

        <Card className="surface-card border-border/60">
          <CardHeader className="flex flex-row items-center gap-3">
            <Ban className="size-5 text-destructive" />
            <CardTitle className="text-lg">Histórico de cancelamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vendasCanceladas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda cancelada.</p>
            ) : (
              vendasCanceladas.map((venda) => {
                const item = detalhes(venda);
                return (
                  <div
                    key={venda.id}
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.representacao} · {item.colaborador}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {venda.quinzena === "quinzena1" ? "1ª quinzena" : "2ª quinzena"} ·{" "}
                          {item.data}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <strong>{brl(venda.valor)}</strong>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => revogarCancelamento(venda.id)}
                        >
                          <RotateCcw className="size-4" />
                          Revogar cancelamento
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Motivo:</span>{" "}
                      {venda.motivoCancelamento}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar venda</DialogTitle>
            <DialogDescription>
              Selecione a venda que caiu. O valor e uma cota serão descontados do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Representação</label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={representacaoId}
                onChange={(event) => {
                  setRepresentacaoId(event.target.value);
                  setColaboradorId("");
                  setVendaId("");
                }}
              >
                <option value="">Selecione a representação</option>
                {dados.representacoes.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.nome}
                  </option>
                ))}
              </select>
            </div>
            {representacaoId && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Colaborador</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={colaboradorId}
                  onChange={(event) => {
                    setColaboradorId(event.target.value);
                    setVendaId("");
                  }}
                >
                  <option value="">Selecione o colaborador</option>
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {colaboradorId && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Valor da venda</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={vendaId}
                  onChange={(event) => setVendaId(event.target.value)}
                >
                  <option value="">Selecione a venda</option>
                  {vendasDoColaborador.map((venda) => (
                    <option key={venda.id} value={venda.id}>
                      {brl(venda.valor)} ·{" "}
                      {venda.quinzena === "quinzena1" ? "1ª quinzena" : "2ª quinzena"} ·{" "}
                      {detalhes(venda).data}
                    </option>
                  ))}
                  <option value="nao-listada">A venda não aparece nesta lista</option>
                </select>
                {vendasDoColaborador.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    A venda pode ter sido lançada diretamente no resultado. Selecione “A venda não
                    aparece nesta lista”.
                  </p>
                )}
              </div>
            )}
            {vendaId === "nao-listada" && (
              <div className="grid gap-4 rounded-lg border border-border/60 p-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="valor-nao-listado">
                    Valor da venda
                  </label>
                  <input
                    id="valor-nao-listado"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Informe o valor exato"
                    value={valorNaoListado}
                    onChange={(event) => setValorNaoListado(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Quinzena</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={quinzenaNaoListada}
                    onChange={(event) =>
                      setQuinzenaNaoListada(event.target.value as "quinzena1" | "quinzena2")
                    }
                  >
                    <option value="quinzena1">1ª quinzena</option>
                    <option value="quinzena2">2ª quinzena</option>
                  </select>
                </div>
              </div>
            )}
            {vendaId && (
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="motivo-cancelamento">
                  Motivo do cancelamento
                </label>
                <textarea
                  id="motivo-cancelamento"
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ex.: cliente desistiu do consórcio"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={
                !vendaId ||
                !motivo.trim() ||
                (vendaId === "nao-listada" &&
                  (!Number(valorNaoListado) || Number(valorNaoListado) <= 0))
              }
              onClick={confirmar}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
