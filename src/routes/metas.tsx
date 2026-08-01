import { createFileRoute } from "@tanstack/react-router";
import { Check, Maximize2, Minimize2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import logo from "@/assets/grupo-invest-logo.jpg?url";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { brl, lucroColaborador, lucroMensal, somaLucro } from "@/lib/reps";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas de Vendas | Grupo Invest" },
      {
        name: "description",
        content:
          "Acompanhe o progresso da meta mensal do Grupo Invest: ganho total, valor atual e quanto falta para bater o objetivo.",
      },
      { property: "og:title", content: "Metas de Vendas | Grupo Invest" },
      {
        property: "og:description",
        content: "Progresso da meta mensal do Grupo Invest em nível de empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Metas,
});

function Metas() {
  const { dados, setMetaEquipe, setMetaColaborador, setMeta } = useStore();
  const { session } = useAuth();
  const { representacoes, metaMensal } = dados;
  const isAdmin = session?.role === "admin";
  const representation = representacoes[0];
  const lucroTotal = somaLucro(representacoes);
  const lucroExibido =
    isAdmin && representation ? lucroTotal : representation ? lucroMensal(representation) : 0;
  const metaExibida = isAdmin
    ? metaMensal
    : representation
      ? (dados.metasEquipe[representation.id] ?? 0)
      : 0;
  const progresso = metaExibida ? Math.min(100, (lucroExibido / metaExibida) * 100) : 0;
  const falta = Math.max(0, metaExibida - lucroExibido);
  const [metaEmpresaDraft, setMetaEmpresaDraft] = useState(metaMensal);
  const [metaEquipeDraft, setMetaEquipeDraft] = useState<Record<string, number | "">>({});
  const [metasColaboradorDraft, setMetasColaboradorDraft] = useState<Record<string, number | "">>(
    {},
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const progressRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMetaEmpresaDraft(metaMensal);
    setMetaEquipeDraft(
      Object.fromEntries(representacoes.map((item) => [item.id, dados.metasEquipe[item.id] ?? ""])),
    );
    setMetasColaboradorDraft(dados.metasColaborador);
  }, [dados.metasColaborador, dados.metasEquipe, metaMensal, representacoes, representation]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    updateFullscreenState();

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const handleToggleFullscreen = async () => {
    if (typeof document === "undefined") return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (progressRef.current?.requestFullscreen) {
        await progressRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AppLayout title="Metas e progresso de vendas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section
          ref={progressRef}
          className="hero-gradient rounded-3xl px-6 py-10 text-primary-foreground shadow-[var(--shadow-glow)] md:px-12"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img
                src={logo}
                alt="Logo Grupo Invest"
                width={64}
                height={64}
                className="h-16 w-16 rounded-2xl bg-background object-contain p-2 shadow-sm"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] opacity-80">Meta do mês</p>
                <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                  {progresso.toFixed(1)}% da meta alcançada
                </h1>
                <p className="mt-2 text-sm opacity-85">
                  {brl(lucroExibido)} de {brl(metaExibida)}
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleToggleFullscreen} className="self-start">
              {isFullscreen ? (
                <>
                  <Minimize2 className="mr-2 h-4 w-4" />
                  Sair da tela cheia
                </>
              ) : (
                <>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Tela cheia
                </>
              )}
            </Button>
          </div>

          <div className="mt-6">
            <Progress value={progresso} className="h-6 bg-background/30" />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="surface-card border-border/60">
              <CardHeader>
                <CardTitle>Ganho total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{brl(lucroExibido)}</p>
              </CardContent>
            </Card>
            <Card className="surface-card border-border/60">
              <CardHeader>
                <CardTitle>Falta para bater</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-accent">{brl(falta)}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Metas por equipe e colaborador</h2>
            <p className="text-sm text-muted-foreground">
              {session?.role === "admin"
                ? "Defina as metas de cada representação."
                : "Acompanhe as metas da sua representação."}
            </p>
          </div>
          {isAdmin && (
            <Card className="surface-card border-border/60">
              <CardContent className="flex flex-wrap items-end gap-3 p-5">
                <div className="space-y-2">
                  <Label htmlFor="meta-empresa">Meta da empresa</Label>
                  <Input
                    id="meta-empresa"
                    type="number"
                    value={metaEmpresaDraft}
                    onChange={(event) =>
                      setMetaEmpresaDraft(
                        event.target.value === "" ? 0 : Number(event.target.value),
                      )
                    }
                  />
                </div>
                <Button onClick={() => setMeta(metaEmpresaDraft)}>
                  <Save className="size-4" /> Salvar meta da empresa
                </Button>
              </CardContent>
            </Card>
          )}
          {representacoes.map((representation) => (
            <Card key={representation.id} className="surface-card border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Meta da equipe {representation.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Realizado: {brl(lucroMensal(representation))} · Meta:{" "}
                    {brl(dados.metasEquipe[representation.id] ?? 0)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`meta-equipe-${representation.id}`} className="sr-only">
                    Meta da equipe
                  </Label>
                  <Input
                    id={`meta-equipe-${representation.id}`}
                    type="number"
                    className="w-36"
                    value={metaEquipeDraft[representation.id] ?? ""}
                    onChange={(event) =>
                      setMetaEquipeDraft((current) => ({
                        ...current,
                        [representation.id]:
                          event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                    placeholder="Meta equipe"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      setMetaEquipe(
                        representation.id,
                        Number(metaEquipeDraft[representation.id] || 0),
                      )
                    }
                  >
                    <Save className="size-4" /> Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <Progress
                  value={
                    dados.metasEquipe[representation.id]
                      ? Math.min(
                          100,
                          (lucroMensal(representation) / dados.metasEquipe[representation.id]) *
                            100,
                        )
                      : 0
                  }
                  className="h-3"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Falta:{" "}
                  {brl(
                    Math.max(
                      0,
                      (dados.metasEquipe[representation.id] ?? 0) - lucroMensal(representation),
                    ),
                  )}
                </p>
              </CardContent>
              <CardContent className="space-y-2">
                {representation.colaboradores.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center gap-3 border-t border-border/60 py-2"
                  >
                    <span className="flex-1 text-sm">{collaborator.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      Realizado {brl(lucroColaborador(collaborator))} · Falta{" "}
                      {brl(
                        Math.max(
                          0,
                          (dados.metasColaborador[collaborator.id] ?? 0) -
                            lucroColaborador(collaborator),
                        ),
                      )}
                    </span>
                    <Input
                      type="number"
                      className="w-32"
                      value={metasColaboradorDraft[collaborator.id] ?? ""}
                      onChange={(event) =>
                        setMetasColaboradorDraft((current) => ({
                          ...current,
                          [collaborator.id]:
                            event.target.value === "" ? "" : Number(event.target.value),
                        }))
                      }
                      placeholder="Meta pessoal"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setMetaColaborador(
                          collaborator.id,
                          Number(metasColaboradorDraft[collaborator.id] || 0),
                        )
                      }
                    >
                      <Check className="size-4" /> Salvar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
