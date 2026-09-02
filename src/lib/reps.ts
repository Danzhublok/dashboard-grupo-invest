export type Colaborador = {
  id: string;
  nome: string;
  foto?: string;
  cargo: "consultor" | "supervisor" | "representante";
  cotas: number | "";
  quinzena1: number | "";
  quinzena2: number | "";
};

export type Saida = {
  id: string;
  motivo: string;
  valor: number;
  data: string;
};

export type Venda = {
  id: string;
  representationId: string;
  collaboratorId: string;
  valor: number;
  quinzena: "quinzena1" | "quinzena2";
  data: string;
  status: "ativa" | "cancelada";
  motivoCancelamento?: string;
  canceladaEm?: string;
};

export const vendaSubstituidaPorImportacao = (venda: Venda) =>
  venda.status === "cancelada" &&
  venda.motivoCancelamento?.startsWith("Substituída por nova importação") === true;

export type Representacao = {
  id: string;
  nome: string;
  logo: string;
  representante: string;
  colaboradores: Colaborador[];
};

export type DadosApp = {
  representacoes: Representacao[];
  metaMensal: number;
  saidas: Saida[];
  vendas: Venda[];
  metasEquipe: Record<string, number>;
  metasColaborador: Record<string, number>;
};

export type UsuarioPainel = {
  id: string;
  nome: string;
  username?: string;
  role: "admin" | "representante";
  representationId?: string;
  representationName?: string;
};

export const dadosIniciais: DadosApp = {
  metaMensal: 0,
  saidas: [],
  vendas: [],
  representacoes: [],
  metasEquipe: {},
  metasColaborador: {},
};

export type DashboardPeriod = "geral" | "quinzena1" | "quinzena2";

export const lucroColaborador = (c: Colaborador) =>
  Number(c.quinzena1 || 0) + Number(c.quinzena2 || 0);
export const lucroColaboradorPorPeriodo = (c: Colaborador, periodo: DashboardPeriod = "geral") => {
  if (periodo === "quinzena1") {
    return Number(c.quinzena1 || 0);
  }

  if (periodo === "quinzena2") {
    return Number(c.quinzena2 || 0);
  }

  return lucroColaborador(c);
};

export const quinzena1Rep = (r: Representacao) =>
  r.colaboradores.reduce((s, x) => s + Number(x.quinzena1 || 0), 0);
export const quinzena2Rep = (r: Representacao) =>
  r.colaboradores.reduce((s, x) => s + Number(x.quinzena2 || 0), 0);
export const lucroMensal = (r: Representacao) => quinzena1Rep(r) + quinzena2Rep(r);
export const lucroRepresentacaoPorPeriodo = (
  r: Representacao,
  periodo: DashboardPeriod = "geral",
) => {
  if (periodo === "quinzena1") {
    return quinzena1Rep(r);
  }

  if (periodo === "quinzena2") {
    return quinzena2Rep(r);
  }

  return lucroMensal(r);
};
export const cotasRep = (r: Representacao) =>
  r.colaboradores.reduce((s, x) => s + Number(x.cotas || 0), 0);

export const somaLucro = (reps: Representacao[]) => reps.reduce((s, r) => s + lucroMensal(r), 0);
export const somaLucroPorPeriodo = (reps: Representacao[], periodo: DashboardPeriod = "geral") =>
  reps.reduce((s, r) => s + lucroRepresentacaoPorPeriodo(r, periodo), 0);
export const somaCotas = (reps: Representacao[]) => reps.reduce((s, r) => s + cotasRep(r), 0);

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const novoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};
