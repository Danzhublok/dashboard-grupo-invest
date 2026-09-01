import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, RotateCcw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  brl,
  lucroColaborador,
  lucroColaboradorPorPeriodo,
  quinzena1Rep,
  quinzena2Rep,
} from "@/lib/reps";
import { comparableName, readSalesFile, type ImportedSale } from "@/lib/spreadsheet-import";

type PreviewSale = ImportedSale & { representationId: string; collaboratorId: string };

export const Route = createFileRoute("/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const { dados, registrarVenda, importarVendas } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string>(dados.representacoes[0]?.id ?? "");
  const [selectedColaborador, setSelectedColaborador] = useState<string>("");
  const [valorVenda, setValorVenda] = useState<string>("");
  const [quinzena, setQuinzena] = useState<"quinzena1" | "quinzena2">("quinzena1");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewSale[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

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
    if (
      !repAtual ||
      !Array.isArray(repAtual.colaboradores) ||
      repAtual.colaboradores.length === 0
    ) {
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

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const rows = await readSalesFile(file);
      const matched = rows.map((row) => {
        let candidates = dados.representacoes.flatMap((rep) =>
          rep.colaboradores
            .filter(
              (collaborator) =>
                comparableName(collaborator.nome) === comparableName(row.collaborator),
            )
            .map((collaborator) => ({ rep, collaborator })),
        );
        if (candidates.length > 1 && row.manager) {
          const manager = comparableName(row.manager);
          const narrowed = candidates.filter(({ rep }) =>
            [rep.nome, rep.representante].some((name) => comparableName(name) === manager),
          );
          if (narrowed.length) candidates = narrowed;
        }
        const match = candidates.length === 1 ? candidates[0] : undefined;
        return {
          ...row,
          representationId: match?.rep.id ?? "",
          collaboratorId: match?.collaborator.id ?? "",
        };
      });
      setPreview(matched);
      setImportOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const importMonth = preview[0]?.date.slice(0, 7) ?? "";
  const importHalves = [...new Set(preview.map((row) => row.half))];
  const inconsistent = preview.some(
    (row) => !row.collaboratorId || row.date.slice(0, 7) !== importMonth,
  );
  const importTotal = preview.reduce((sum, row) => sum + row.amount, 0);

  const confirmImport = async () => {
    if (!importMonth || inconsistent) return;
    setImporting(true);
    const ok = await importarVendas({
      sales: preview.map((row) => ({
        row: row.row,
        date: row.date,
        representationId: row.representationId,
        collaboratorId: row.collaboratorId,
        amount: row.amount,
      })),
    });
    setImporting(false);
    if (ok) {
      setImportOpen(false);
      toast.success("Planilha importada e totais recalculados.");
    }
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
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.pdf,application/pdf"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileInput.current?.click()} className="gap-2">
              <Upload className="size-4" /> Importar planilha
            </Button>
            <Button onClick={onAbrirModal} className="gap-2">
              <Plus className="size-4" /> Registrar venda
            </Button>
          </div>
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
                        {brl(
                          (rep.colaboradores ?? []).reduce(
                            (sum, c) => sum + lucroColaborador(c),
                            0,
                          ),
                        )}
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
                <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {(dados.vendas ?? []).slice(0, 8).map((venda) => {
                    const rep = dados.representacoes.find((r) => r.id === venda.representationId);
                    const colaborador = rep?.colaboradores?.find(
                      (c) => c.id === venda.collaboratorId,
                    );
                    const dataValida = venda?.data ? new Date(venda.data) : undefined;
                    const dataTexto =
                      dataValida && !Number.isNaN(dataValida.getTime())
                        ? dataValida.toLocaleDateString("pt-BR")
                        : "Data indisponível";

                    return (
                      <div
                        key={venda.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{rep?.nome ?? "Representação"}</p>
                            {venda.status === "cancelada" && (
                              <Badge variant="destructive">Cancelada</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {colaborador?.nome ?? "Colaborador"} ·{" "}
                            {venda.quinzena === "quinzena1" ? "1ª quinzena" : "2ª quinzena"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={
                              venda.status === "cancelada"
                                ? "text-sm font-bold text-muted-foreground line-through"
                                : "text-sm font-bold text-accent"
                            }
                          >
                            {brl(Number(venda.valor ?? 0))}
                          </p>
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
                Escolha a representação, o colaborador e a quinzena para registrar automaticamente o
                valor.
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

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Conferir importação</DialogTitle>
              <DialogDescription>
                A data define automaticamente o mês e a quinzena. Confirmar substitui somente essa
                quinzena; use Refazer para escolher outra planilha.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Período detectado</p>
                  <p className="font-semibold">
                    {importMonth || "-"} ·{" "}
                    {importHalves.length > 1
                      ? "1ª e 2ª quinzenas"
                      : importHalves[0] === "quinzena1"
                        ? "1ª quinzena"
                        : "2ª quinzena"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Contratos</p>
                  <p className="font-semibold">{preview.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="font-semibold">{brl(importTotal)}</p>
                </CardContent>
              </Card>
            </div>
            {inconsistent && (
              <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Corrija os consultores não
                reconhecidos e as datas divergentes. Cada arquivo deve conter somente um mês; ele
                pode incluir as duas quinzenas.
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Nome na planilha</th>
                    <th className="p-3">Consultor no sistema</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={`${row.row}-${index}`} className="border-t">
                      <td className="p-3 whitespace-nowrap">
                        <input
                          type="date"
                          className="h-9 rounded-md border bg-background px-2"
                          value={row.date}
                          onChange={(event) => {
                            const date = event.target.value;
                            const day = Number(date.slice(8, 10));
                            setPreview((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      date,
                                      half: day <= 14 ? "quinzena1" : "quinzena2",
                                    }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </td>
                      <td className="p-3">{row.collaborator}</td>
                      <td className="p-3">
                        <select
                          className="h-9 min-w-52 rounded-md border bg-background px-2"
                          value={row.collaboratorId}
                          onChange={(event) => {
                            const collaboratorId = event.target.value;
                            const rep = dados.representacoes.find((item) =>
                              item.colaboradores.some((c) => c.id === collaboratorId),
                            );
                            setPreview((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, collaboratorId, representationId: rep?.id ?? "" }
                                  : item,
                              ),
                            );
                          }}
                        >
                          <option value="">Selecione...</option>
                          {dados.representacoes.flatMap((rep) =>
                            rep.colaboradores.map((c) => (
                              <option key={c.id} value={c.id}>
                                {rep.nome} · {c.nome}
                              </option>
                            )),
                          )}
                        </select>
                      </td>
                      <td className="p-3 text-right font-medium">{brl(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInput.current?.click()}
              >
                <RotateCcw className="size-4" /> Refazer
              </Button>
              <Button disabled={inconsistent || importing} onClick={() => void confirmImport()}>
                {importing ? "Importando..." : "Confirmar importação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
