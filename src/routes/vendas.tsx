import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { brl, lucroColaborador, lucroColaboradorPorPeriodo, quinzena1Rep, quinzena2Rep } from "@/lib/reps";

export const Route = createFileRoute("/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const { dados, registrarVenda } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string>(dados.representacoes[0]?.id ?? "");
  const [selectedColaborador, setSelectedColaborador] = useState<string>("");
  const [valorVenda, setValorVenda] = useState<string>("");
  const [quinzena, setQuinzena] = useState<"quinzena1" | "quinzena2">("quinzena1");

  const repSelecionada = useMemo(() => {
    if (dados.representacoes.length === 0) return undefined;

    if (selectedRep) {
      return dados.representacoes.find((rep) => rep.id === selectedRep) ?? dados.representacoes[0];
    }

    return dados.representacoes[0];
  }, [dados.representacoes, selectedRep]);

  const colaboradoresDaRep = repSelecionada?.colaboradores ?? [];

  useEffect(() => {
    if (!selectedRep && dados.representacoes.length > 0) {
      const primeiraRep = dados.representacoes[0];
      const primeiraCol = primeiraRep?.colaboradores?.[0]?.id ?? "";
      setSelectedRep(primeiraRep?.id ?? "");
      setSelectedColaborador(primeiraCol);
    }
  }, [dados.representacoes, selectedRep]);

  useEffect(() => {
    const repAtual = dados.representacoes.find((rep) => rep.id === selectedRep);
    if (!repAtual || !Array.isArray(repAtual.colaboradores) || repAtual.colaboradores.length === 0) {
      if (selectedColaborador) {
        setSelectedColaborador("");
      }
      return;
    }

    if (!repAtual.colaboradores.some((colaborador) => colaborador.id === selectedColaborador)) {
      setSelectedColaborador(repAtual.colaboradores[0]?.id ?? "");
    }
  }, [dados.representacoes, selectedColaborador, selectedRep]);

  const onAbrirModal = () => {
    const primeiraRep = dados.representacoes[0];
    const primeiraCol = primeiraRep?.colaboradores?.[0]?.id ?? "";
    setSelectedRep(primeiraRep?.id ?? "");
    setSelectedColaborador(primeiraCol);
    setValorVenda("");
    setQuinzena("quinzena1");
    setDialogOpen(true);
  };

  const onSalvarVenda = () => {
    const valor = Number(valorVenda);
    if (!selectedRep || !selectedColaborador || !valor || valor <= 0) return;

    registrarVenda({
      representationId: selectedRep,
      collaboratorId: selectedColaborador,
      valor,
      quinzena,
    });

    setDialogOpen(false);
    setValorVenda("");
  };

  return (
    <AppLayout title="Vendas">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Registro dinâmico
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Vendas</h1>
          </div>
          <Button onClick={onAbrirModal} className="gap-2">
            <Plus className="size-4" />
            Registrar venda
          </Button>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {dados.representacoes.length === 0 ? (
            <Card className="surface-card border-border/60 md:col-span-2 xl:col-span-3">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Ainda não há representações carregadas para registrar vendas.
                </p>
              </CardContent>
            </Card>
          ) : (
            dados.representacoes.map((rep) => (
              <Card key={rep.id} className="surface-card border-border/60">
                <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
                  <img src={rep.logo} alt="" className="size-10 object-contain" />
                  <div className="flex-1">
                    <CardTitle className="text-base">{rep.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{rep.representante}</p>
                  </div>
                  <Badge variant="secondary">{rep.colaboradores?.length ?? 0}</Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">1ª quinzena</span>
                      <strong>{brl(quinzena1Rep(rep))}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">2ª quinzena</span>
                      <strong>{brl(quinzena2Rep(rep))}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/50 pt-2">
                      <span className="font-semibold">Lucro</span>
                      <strong className="text-accent">
                        {brl((rep.colaboradores ?? []).reduce((sum, c) => sum + lucroColaborador(c), 0))}
                      </strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section className="grid gap-6">
          <Card className="surface-card border-border/60">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-lg">Últimas vendas registradas</CardTitle>
              <Badge variant="secondary">{(dados.vendas ?? []).length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dados.vendas ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma venda registrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {(dados.vendas ?? []).slice(0, 8).map((venda) => {
                    const rep = dados.representacoes.find((r) => r.id === venda.representationId);
                    const colaborador = rep?.colaboradores?.find((c) => c.id === venda.collaboratorId);
                    const dataValida = venda?.data ? new Date(venda.data) : undefined;
                    const dataTexto = dataValida && !Number.isNaN(dataValida.getTime())
                      ? dataValida.toLocaleDateString("pt-BR")
                      : "Data indisponível";

                    return (
                      <div
                        key={venda.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">{rep?.nome ?? "Representação"}</p>
                          <p className="text-xs text-muted-foreground">
                            {colaborador?.nome ?? "Colaborador"} · {venda.quinzena === "quinzena1" ? "1ª quinzena" : "2ª quinzena"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-accent">{brl(Number(venda.valor ?? 0))}</p>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {dataTexto}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar nova venda</DialogTitle>
              <DialogDescription>
                Escolha a representação, o colaborador e a quinzena para registrar automaticamente o valor.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Representação</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedRep}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSelectedRep(nextValue);
                    const nextRep = dados.representacoes.find((r) => r.id === nextValue);
                    setSelectedColaborador(nextRep?.colaboradores?.[0]?.id ?? "");
                  }}
                >
                  {dados.representacoes.length > 0 ? (
                    dados.representacoes.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.nome}
                      </option>
                    ))
                  ) : (
                    <option value="">Sem representações</option>
                  )}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Colaborador</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedColaborador}
                  onChange={(event) => setSelectedColaborador(event.target.value)}
                  disabled={colaboradoresDaRep.length === 0}
                >
                  {colaboradoresDaRep.length === 0 && <option value="">Sem colaboradores</option>}
                  {colaboradoresDaRep.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Valor da venda</label>
                <input
                  type="number"
                  min="1"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Ex.: 12500"
                  value={valorVenda}
                  onChange={(event) => setValorVenda(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Quinzena</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={quinzena}
                  onChange={(event) => setQuinzena(event.target.value as "quinzena1" | "quinzena2")}
                >
                  <option value="quinzena1">1ª Quinzena</option>
                  <option value="quinzena2">2ª Quinzena</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={onSalvarVenda}>Salvar venda</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
