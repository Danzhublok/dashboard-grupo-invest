import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { brl, cotasRep, lucroColaborador, lucroMensal } from "@/lib/reps";

export const Route = createFileRoute("/equipes")({
  head: () => ({
    meta: [
      { title: "Vendas por Colaborador | Grupo Invest" },
      {
        name: "description",
        content:
          "Desempenho individual de representantes e colaboradores de cada representação do Grupo Invest.",
      },
      { property: "og:title", content: "Vendas por Colaborador | Grupo Invest" },
      {
        property: "og:description",
        content: "Veja as vendas de cada colaborador dentro da sua representação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Equipes,
});

function Equipes() {
  const { dados, updateColaborador } = useStore();
  const { session } = useAuth();
  const isRepresentative = session?.role === "representante";
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();

  const reps = dados.representacoes
    .map((r) => ({
      ...r,
      colaboradores: termo
        ? r.colaboradores.filter(
            (c) => c.nome.toLowerCase().includes(termo) || r.nome.toLowerCase().includes(termo),
          )
        : r.colaboradores,
    }))
    .filter((r) => !termo || r.colaboradores.length > 0 || r.nome.toLowerCase().includes(termo));

  return (
    <AppLayout title="Vendas por representante e colaborador">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipes</h1>
            <p className="text-sm text-muted-foreground">
              {isRepresentative
                ? "Lance as cotas e os valores de cada quinzena para acompanhar o rendimento da equipe."
                : "Desempenho individual dentro de cada representação."}
            </p>
          </div>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar colaborador ou representação"
            className="sm:w-72"
          />
        </div>

        {reps.map((r) => {
          const total = lucroMensal(r);
          return (
            <Card key={r.id} className="surface-card border-border/60">
              <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
                <img
                  src={r.logo}
                  alt={`Logo ${r.nome}`}
                  loading="lazy"
                  className="size-11 object-contain"
                />
                <div className="flex-1">
                  <CardTitle className="text-lg">{r.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Representante: {r.representante} · {r.colaboradores.length} colaboradores
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{cotasRep(r)} cotas</Badge>
                  <p className="mt-1 text-sm font-semibold">{brl(total)}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {r.colaboradores.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Nenhum colaborador cadastrado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-right">Cotas</TableHead>
                        <TableHead className="text-right">1ª quinzena</TableHead>
                        <TableHead className="text-right">2ª quinzena</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-32">Participação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...r.colaboradores]
                        .sort((a, b) => lucroColaborador(b) - lucroColaborador(a))
                        .map((c) => {
                          const v = lucroColaborador(c);
                          const pct = total ? (v / total) * 100 : 0;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">
                                <div>{c.nome}</div>
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  {c.cargo}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {isRepresentative ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={c.cotas}
                                    aria-label={`Cotas de ${c.nome}`}
                                    className="ml-auto w-24 text-right"
                                    onChange={(event) =>
                                      updateColaborador(r.id, c.id, {
                                        cotas:
                                          event.target.value === ""
                                            ? ""
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                ) : (
                                  c.cotas
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isRepresentative ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={c.quinzena1}
                                    aria-label={`Primeira quinzena de ${c.nome}`}
                                    className="ml-auto w-32 text-right"
                                    onChange={(event) =>
                                      updateColaborador(r.id, c.id, {
                                        quinzena1:
                                          event.target.value === ""
                                            ? ""
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                ) : (
                                  brl(Number(c.quinzena1 || 0))
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isRepresentative ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={c.quinzena2}
                                    aria-label={`Segunda quinzena de ${c.nome}`}
                                    className="ml-auto w-32 text-right"
                                    onChange={(event) =>
                                      updateColaborador(r.id, c.id, {
                                        quinzena2:
                                          event.target.value === ""
                                            ? ""
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                ) : (
                                  brl(Number(c.quinzena2 || 0))
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{brl(v)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-2" />
                                  <span className="w-9 text-right text-xs text-muted-foreground">
                                    {pct.toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
