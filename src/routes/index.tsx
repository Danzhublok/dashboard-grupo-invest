import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownToLine, Ban, CalendarDays, Coins, TrendingUp, Users, Wallet } from "lucide-react";
import { useState } from "react";

import logo from "@/assets/grupo-invest-logo.jpg?url";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  brl,
  cotasRep,
  lucroColaborador,
  lucroColaboradorPorPeriodo,
  lucroMensal,
  lucroRepresentacaoPorPeriodo,
  quinzena1Rep,
  quinzena2Rep,
  somaCotas,
  somaLucroPorPeriodo,
  vendaSubstituidaPorImportacao,
  type DashboardPeriod,
} from "@/lib/reps";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Lucros | Grupo Invest" },
      {
        name: "description",
        content:
          "Painel de resultados das representações do Grupo Invest: lucro mensal, quinzenal e cotas de crédito imobiliário.",
      },
      { property: "og:title", content: "Dashboard de Lucros | Grupo Invest" },
      {
        property: "og:description",
        content: "Acompanhe o lucro mensal e quinzenal de cada representação do Grupo Invest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="surface-card border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { dados, mesSelecionado, setMesSelecionado } = useStore();
  const { session } = useAuth();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<DashboardPeriod>("geral");
  const representacoes = dados.representacoes;
  const ganhoLiquidoVendas = somaLucroPorPeriodo(representacoes, periodoSelecionado);
  const saidasMes = dados.saidas.filter((saida) => saida.data.startsWith(mesSelecionado));
  const saidasAnterior = dados.saidas.filter((saida) =>
    saida.data.startsWith(mesAnterior(mesSelecionado)),
  );
  const totalSaidas = saidasMes.reduce((sum, saida) => sum + saida.valor, 0);
  const totalSaidasAnterior = saidasAnterior.reduce((sum, saida) => sum + saida.valor, 0);
  const cotasTotais = somaCotas(representacoes);
  const ticketMedio = cotasTotais ? Math.round(ganhoLiquidoVendas / cotasTotais) : 0;
  const vendasCanceladas = dados.vendas.filter(
    (venda) =>
      venda.status === "cancelada" &&
      !vendaSubstituidaPorImportacao(venda) &&
      venda.data.startsWith(mesSelecionado) &&
      (periodoSelecionado === "geral" || venda.quinzena === periodoSelecionado),
  );
  const valorCancelado = vendasCanceladas.reduce(
    (total, venda) => total + Number(venda.valor || 0),
    0,
  );
  const ganhoBruto = ganhoLiquidoVendas + valorCancelado;
  const lucroTotal = ganhoBruto - valorCancelado - totalSaidas;
  const cancelamentosPorRepresentacao = representacoes
    .map((representacao) => ({
      name: representacao.nome,
      value: vendasCanceladas
        .filter((venda) => venda.representationId === representacao.id)
        .reduce((total, venda) => total + Number(venda.valor || 0), 0),
    }))
    .filter((representacao) => representacao.value > 0);
  const vendasPorDia = Object.values(
    dados.vendas
      .filter(
        (venda) =>
          venda.status === "ativa" &&
          (periodoSelecionado === "geral" || venda.quinzena === periodoSelecionado),
      )
      .reduce<Record<string, { data: string; valor: number }>>((dias, venda) => {
        const data = venda.data.slice(0, 10);
        const atual = dias[data] ?? { data, valor: 0 };
        atual.valor += Number(venda.valor || 0);
        dias[data] = atual;
        return dias;
      }, {}),
  )
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((dia) => ({
      ...dia,
      label: new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR"),
    }));
  const ranking = [...representacoes].sort(
    (a, b) =>
      lucroRepresentacaoPorPeriodo(b, periodoSelecionado) -
      lucroRepresentacaoPorPeriodo(a, periodoSelecionado),
  );
  const lider = ranking[0];
  const pieData = representacoes.map((r) => ({
    name: r.nome,
    value: lucroRepresentacaoPorPeriodo(r, periodoSelecionado),
  }));
  const individualPieData = representacoes.flatMap((representation) =>
    representation.colaboradores.map((collaborator) => ({
      name: collaborator.nome,
      value: lucroColaboradorPorPeriodo(collaborator, periodoSelecionado),
    })),
  );
  const vendedores = representacoes.flatMap((r) =>
    r.colaboradores.filter((c) => c.cargo === "consultor").map((c) => ({ ...c, logo: r.logo })),
  );
  const supervisores = representacoes.flatMap((r) =>
    r.colaboradores.filter((c) => c.cargo === "supervisor").map((c) => ({ ...c, logo: r.logo })),
  );

  const periodoLabel: Record<DashboardPeriod, string> = {
    geral: "Geral",
    quinzena1: "1ª Quinzena",
    quinzena2: "2ª Quinzena",
  };

  return (
    <AppLayout title="Visão geral das representações">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="hero-gradient relative overflow-hidden rounded-3xl px-6 py-10 text-primary-foreground shadow-[var(--shadow-glow)] md:px-12 md:py-14">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <img
              src={logo}
              alt="Logo Grupo Invest — Investimentos & Consórcios"
              width={128}
              height={128}
              className="size-28 rounded-2xl bg-background object-contain p-2 shadow-lg"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] opacity-80">
                Investimentos &amp; Consórcios
              </p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                GRUPO INVEST | PAINEL EXECUTIVO DE PERFORMANCE
              </h1>
              <p className="mt-2 max-w-2xl text-sm opacity-85 md:text-base">
                Produção • Receita • Rentabilidade • Representações • Performance Individual
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Selecionar período</span>
            <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/90 p-1 shadow-sm">
              <Button
                variant={periodoSelecionado === "geral" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodoSelecionado("geral")}
                className="rounded-full px-4"
                aria-pressed={periodoSelecionado === "geral"}
              >
                Geral
              </Button>
              <Button
                variant={periodoSelecionado === "quinzena1" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodoSelecionado("quinzena1")}
                className="rounded-full px-4"
                aria-pressed={periodoSelecionado === "quinzena1"}
              >
                1ª Quinzena
              </Button>
              <Button
                variant={periodoSelecionado === "quinzena2" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodoSelecionado("quinzena2")}
                className="rounded-full px-4"
                aria-pressed={periodoSelecionado === "quinzena2"}
              >
                2ª Quinzena
              </Button>
            </div>
          </div>
          <div className="rounded-full border border-border/60 bg-background/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {periodoLabel[periodoSelecionado]}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Wallet}
            label="Lucro total"
            value={brl(lucroTotal)}
            hint="Ganho bruto menos cancelamentos e saídas"
          />
          <KpiCard
            icon={Coins}
            label="Cotas vendidas"
            value={String(cotasTotais)}
            hint="Todas as representações"
          />
          <KpiCard
            icon={TrendingUp}
            label="Ticket médio / cota"
            value={brl(ticketMedio)}
            hint="Lucro médio por cota"
          />
          <KpiCard
            icon={Users}
            label="Representação líder"
            value={lider ? lider.nome : "—"}
            hint={
              lider
                ? `${brl(lucroRepresentacaoPorPeriodo(lider, periodoSelecionado))} em ${periodoLabel[periodoSelecionado]}`
                : "Cadastre uma representação"
            }
          />
          <KpiCard
            icon={TrendingUp}
            label="Ganho bruto"
            value={brl(ganhoBruto)}
            hint={`${periodoLabel[periodoSelecionado]} · antes dos cancelamentos`}
          />
          <KpiCard
            icon={ArrowDownToLine}
            label="Saídas"
            value={brl(totalSaidas)}
            hint="Custos registrados no período"
          />
          <KpiCard
            icon={Ban}
            label="Vendas canceladas"
            value={String(vendasCanceladas.length)}
            hint={`${brl(valorCancelado)} cancelados em ${periodoLabel[periodoSelecionado]}`}
          />
        </section>

        <Card className="surface-card border-border/60">
          <CardContent className="flex flex-wrap items-end gap-4 p-5">
            <div className="space-y-2">
              <label htmlFor="mes-dashboard" className="text-sm font-medium">
                Comparar mês
              </label>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <input
                  id="mes-dashboard"
                  type="month"
                  value={mesSelecionado}
                  onChange={(e) => setMesSelecionado(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Saídas do mês: <strong className="text-foreground">{brl(totalSaidas)}</strong>
            </div>
            <div className="text-sm text-muted-foreground">
              Mês anterior: <strong className="text-foreground">{brl(totalSaidasAnterior)}</strong>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>
                {session?.role === "admin"
                  ? "Participação no lucro por representação"
                  : "Participação no lucro por colaborador"}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={session?.role === "admin" ? pieData : individualPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={115}
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {(session?.role === "admin" ? pieData : individualPieData).map((entry, i) => (
                      <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>Ranking das representações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ranking.slice(0, 3).map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <span className="w-6 text-sm font-semibold text-muted-foreground">{i + 1}º</span>
                  <img
                    src={r.logo}
                    alt={`Logo ${r.nome}`}
                    loading="lazy"
                    className="size-9 object-contain"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {cotasRep(r)} cotas · {r.representante}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{brl(lucroMensal(r))}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>Vendas canceladas por representação</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {cancelamentosPorRepresentacao.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  Nenhuma venda cancelada no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cancelamentosPorRepresentacao}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={115}
                      paddingAngle={3}
                      isAnimationActive={false}
                    >
                      {cancelamentosPorRepresentacao.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => brl(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card className="surface-card border-border/60">
            <CardHeader>
              <CardTitle>Vendas por dia</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {vendasPorDia.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  Nenhuma venda ativa no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendasPorDia} margin={{ top: 12, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value: number) => brl(value)}
                    />
                    <Tooltip
                      formatter={(value: number) => brl(value)}
                      labelFormatter={(label) => `Dia ${label}`}
                    />
                    <Bar
                      dataKey="valor"
                      name="Vendas"
                      fill="var(--chart-2)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        {session?.role === "admin" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <RankingCard
              title="Top 3 vendedores"
              periodo={periodoSelecionado}
              entries={vendedores
                .sort(
                  (a, b) =>
                    lucroColaboradorPorPeriodo(b, periodoSelecionado) -
                    lucroColaboradorPorPeriodo(a, periodoSelecionado),
                )
                .slice(0, 3)}
            />
            <RankingCard
              title="Top 3 supervisores"
              periodo={periodoSelecionado}
              entries={supervisores
                .sort(
                  (a, b) =>
                    lucroColaboradorPorPeriodo(b, periodoSelecionado) -
                    lucroColaboradorPorPeriodo(a, periodoSelecionado),
                )
                .slice(0, 3)}
            />
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {representacoes.map((r) => (
            <Card key={r.id} className="surface-card overflow-hidden border-border/60">
              <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
                <img
                  src={r.logo}
                  alt={`Logo da representação ${r.nome}`}
                  loading="lazy"
                  className="size-12 object-contain"
                />
                <div className="flex-1">
                  <CardTitle className="text-lg">{r.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">Representante: {r.representante}</p>
                </div>
                <Badge variant="secondary">{cotasRep(r)} cotas</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">1ª quinzena</td>
                      <td className="py-2 text-right font-medium">{brl(quinzena1Rep(r))}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">2ª quinzena</td>
                      <td className="py-2 text-right font-medium">{brl(quinzena2Rep(r))}</td>
                    </tr>
                    <tr>
                      <td className="pt-3 font-semibold">Lucro mensal</td>
                      <td className="pt-3 text-right text-lg font-bold text-accent">
                        {brl(lucroMensal(r))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Link
                  to="/equipes"
                  className="mt-4 inline-flex text-xs font-medium text-primary hover:underline"
                >
                  Ver {r.colaboradores.length} colaboradores →
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}

function mesAnterior(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function RankingCard({
  title,
  entries,
  periodo,
}: {
  title: string;
  periodo: DashboardPeriod;
  entries: Array<{
    id: string;
    nome: string;
    foto?: string;
    logo: string;
    cotas: number | "";
    quinzena1: number | "";
    quinzena2: number | "";
  }>;
}) {
  return (
    <Card className="surface-card border-border/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Atribua cargos aos colaboradores para formar este ranking.
          </p>
        ) : (
          entries.map((entry, index) => {
            const valorRanking =
              periodo === "quinzena1"
                ? Number(entry.quinzena1 || 0)
                : periodo === "quinzena2"
                  ? Number(entry.quinzena2 || 0)
                  : Number(entry.quinzena1 || 0) + Number(entry.quinzena2 || 0);

            return (
              <div
                key={`${entry.id}-${entry.logo}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <span className="w-6 font-semibold text-muted-foreground">{index + 1}º</span>
                <img
                  src={entry.foto || entry.logo}
                  alt={`Foto de ${entry.nome}`}
                  className="size-10 rounded-full object-cover"
                />
                <span className="flex-1 font-medium">{entry.nome}</span>
                <span className="font-semibold">{brl(valorRanking)}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
