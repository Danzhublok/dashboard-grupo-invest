import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, Plus, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { brl, novoId } from "@/lib/reps";

export const Route = createFileRoute("/saidas")({ component: Saidas });

const hoje = () => new Date().toISOString().slice(0, 10);

function Saidas() {
  const { dados, addSaida, removeSaida } = useStore();
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [data, setData] = useState(hoje);

  const total = dados.saidas.reduce((sum, saida) => sum + saida.valor, 0);
  const adicionar = () => {
    if (!motivo.trim() || valor === "" || valor <= 0) return;
    addSaida({ id: novoId(), motivo: motivo.trim(), valor, data });
    setMotivo("");
    setValor("");
    setData(hoje());
  };

  return (
    <AppLayout title="Registro de saídas">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Saídas</h1>
          <p className="text-sm text-muted-foreground">
            Registre comissões, tráfego pago e outros custos para acompanhar o lucro líquido.
          </p>
        </div>

        <Card className="surface-card border-border/60">
          <CardHeader>
            <CardTitle>Nova saída</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                value={motivo}
                placeholder="Ex.: Tráfego pago"
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor-saida">Valor (R$)</Label>
              <Input
                id="valor-saida"
                type="number"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-saida">Data</Label>
              <Input
                id="data-saida"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Button
                onClick={adicionar}
                disabled={!motivo.trim() || valor === "" || valor <= 0}
                className="w-full lg:w-auto"
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Histórico</CardTitle>
            <span className="text-sm font-semibold text-destructive">Total: {brl(total)}</span>
          </CardHeader>
          <CardContent>
            {dados.saidas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <ArrowDownToLine className="size-8" />
                <p>Nenhuma saída registrada.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {[...dados.saidas]
                  .sort((a, b) => b.data.localeCompare(a.data))
                  .map((saida) => (
                    <div key={saida.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1">
                        <p className="font-medium">{saida.motivo}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(`${saida.data}T12:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="font-semibold text-destructive">- {brl(saida.valor)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover saída ${saida.motivo}`}
                        onClick={() => removeSaida(saida.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
