import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CalendarDays, Check, ImagePlus, Plus, RotateCcw, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { brl, lucroMensal, novoId, somaLucro, type Representacao } from "@/lib/reps";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Grupo Invest" },
      {
        name: "description",
        content:
          "Configure metas, adicione ou remova representações e gerencie colaboradores do Grupo Invest.",
      },
      { property: "og:title", content: "Configurações | Grupo Invest" },
      {
        property: "og:description",
        content: "Gestão de metas, representações, logos e colaboradores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Configuracoes,
});

const lerArquivo = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function LogoUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-lg border border-border/60 bg-background/60">
        {value ? (
          <img src={value} alt="Logo" className="size-10 object-contain" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        Trocar logo
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await lerArquivo(file));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FotoUpload({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background/60">
        {value ? (
          <img src={value} alt="Foto do colaborador" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground" />
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        {value ? "Trocar foto" : "Adicionar foto"}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await lerArquivo(file));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function RepEditor({ rep, isAdmin }: { rep: Representacao; isAdmin: boolean }) {
  const {
    updateRepresentacao,
    removeRepresentacao,
    addColaborador,
    updateColaborador,
    removeColaborador,
    salvar,
  } = useStore();
  const [novoNome, setNovoNome] = useState("");
  const [salvo, setSalvo] = useState(false);

  return (
    <Card className="surface-card border-border/60">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={rep.logo}
            alt={`Logo ${rep.nome}`}
            className="size-10 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{rep.nome}</CardTitle>
            <p className="text-xs text-muted-foreground">{brl(lucroMensal(rep))} no mês</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              onClick={async () => {
                setSalvo(false);
                setSalvo(await salvar());
              }}
            >
              <Check className="size-4" /> {salvo ? "Salvo" : "Salvar"}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeRepresentacao(rep.id)}
            >
              <Trash2 className="size-4" /> Remover
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`nome-${rep.id}`}>Nome da representação</Label>
            <Input
              id={`nome-${rep.id}`}
              value={rep.nome}
              disabled={!isAdmin}
              onChange={(e) => updateRepresentacao(rep.id, { nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`resp-${rep.id}`}>Representante</Label>
            <Input
              id={`resp-${rep.id}`}
              value={rep.representante}
              disabled={!isAdmin}
              onChange={(e) => updateRepresentacao(rep.id, { representante: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Logo</Label>
            <LogoUpload
              value={rep.logo}
              onChange={(logo) => updateRepresentacao(rep.id, { logo })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Colaboradores</p>
          <div className="hidden gap-2 px-1 text-xs text-muted-foreground lg:grid lg:grid-cols-[1.4fr_1.4fr_0.8fr_0.5fr_1fr_1fr_auto]">
            <span>Nome</span>
            <span>Foto</span>
            <span>Cargo</span>
            <span>Cotas</span>
            <span>1ª quinzena (R$)</span>
            <span>2ª quinzena (R$)</span>
            <span />
          </div>
          {rep.colaboradores.map((c) => (
            <div
              key={c.id}
              className="grid gap-2 rounded-xl border border-border/60 p-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_0.8fr_0.5fr_1fr_1fr_auto] lg:border-0 lg:p-0"
            >
              <Input
                value={c.nome}
                aria-label="Nome do colaborador"
                onChange={(e) => updateColaborador(rep.id, c.id, { nome: e.target.value })}
              />
              <FotoUpload
                value={c.foto}
                onChange={(foto) => updateColaborador(rep.id, c.id, { foto })}
              />
              <select
                value={c.cargo}
                aria-label="Cargo"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(e) =>
                  updateColaborador(rep.id, c.id, { cargo: e.target.value as typeof c.cargo })
                }
              >
                <option value="consultor">Consultor</option>
                <option value="supervisor">Supervisor</option>
                <option value="representante">Representante</option>
              </select>
              <Input
                type="number"
                value={c.cotas}
                aria-label="Cotas"
                onChange={(e) =>
                  updateColaborador(rep.id, c.id, {
                    cotas: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
              <Input
                type="number"
                value={c.quinzena1}
                aria-label="Primeira quinzena"
                onChange={(e) =>
                  updateColaborador(rep.id, c.id, {
                    quinzena1: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
              <Input
                type="number"
                value={c.quinzena2}
                aria-label="Segunda quinzena"
                onChange={(e) =>
                  updateColaborador(rep.id, c.id, {
                    quinzena2: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${c.nome}`}
                  onClick={() => removeColaborador(rep.id, c.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={novoNome}
              placeholder="Nome do novo colaborador"
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!novoNome.trim()}
              onClick={() => {
                addColaborador(rep.id, {
                  id: novoId(),
                  nome: novoNome.trim(),
                  cargo: "consultor",
                  cotas: "",
                  quinzena1: "",
                  quinzena2: "",
                });
                setNovoNome("");
              }}
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Configuracoes() {
  const { dados, mesSelecionado, setMesSelecionado, setMeta, addRepresentacao, resetar, salvar } =
    useStore();
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [nome, setNome] = useState("");
  const [representante, setRepresentante] = useState("");
  const [logo, setLogo] = useState("");
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const lucroTotal = somaLucro(dados.representacoes);

  return (
    <AppLayout title="Configurações do painel">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              Metas, representações, logos e colaboradores. As alterações são salvas no Supabase.
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                size="sm"
                disabled={salvando}
                onClick={async () => {
                  setSalvando(true);
                  setSalvo(false);
                  setSalvo(await salvar());
                  setSalvando(false);
                }}
              >
                <Check className="size-4" />
                {salvando ? "Salvando..." : salvo ? "Alterações salvas" : "Salvar alterações"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={resetar}>
              <RotateCcw className="size-4" /> Restaurar padrão
            </Button>
          </div>
        </div>

        <Card className="surface-card border-border/60">
          <CardContent className="flex flex-wrap items-end gap-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="mes-configuracoes">Mês dos dados</Label>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <Input
                  id="mes-configuracoes"
                  type="month"
                  className="w-48"
                  value={mesSelecionado}
                  onChange={(event) => setMesSelecionado(event.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Valores, cotas e metas abaixo pertencem ao mês selecionado.
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>Meta mensal do grupo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="meta">Valor da meta (R$)</Label>
                <Input
                  id="meta"
                  type="number"
                  className="w-56"
                  value={dados.metaMensal}
                  onChange={(e) => setMeta(Number(e.target.value) || 0)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Realizado atual:{" "}
                <span className="font-semibold text-foreground">{brl(lucroTotal)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>Adicionar representação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nova-nome">Nome</Label>
                <Input
                  id="nova-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Roma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nova-resp">Representante</Label>
                <Input
                  id="nova-resp"
                  value={representante}
                  onChange={(e) => setRepresentante(e.target.value)}
                  placeholder="Ex.: Reinaldo"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <LogoUpload value={logo} onChange={setLogo} />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={async () => {
                    setCriando(true);
                    await addRepresentacao({
                      id: novoId(),
                      nome: nome.trim(),
                      representante: representante.trim() || "A definir",
                      logo,
                    });
                    setCriando(false);
                    setNome("");
                    setRepresentante("");
                    setLogo("");
                  }}
                  disabled={!nome.trim() || !representante.trim() || criando}
                >
                  <Plus className="size-4" />{" "}
                  {criando ? "Criando acesso..." : "Criar representação"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {dados.representacoes.map((rep) => (
          <RepEditor key={rep.id} rep={rep} isAdmin={isAdmin} />
        ))}
      </div>
    </AppLayout>
  );
}
