import * as XLSX from "xlsx";

export type ImportedSale = {
  row: number;
  date: string;
  manager: string;
  collaborator: string;
  amount: number;
  half: "quinzena1" | "quinzena2";
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases = {
  date: ["data", "datadavenda", "dia"],
  manager: ["gerente", "representante", "equipe", "adm", "supervisor"],
  collaborator: ["consultor", "consultora", "colaborador", "vendedor", "nome"],
  amount: ["valor", "valordavenda", "contrato", "valorcontrato", "credito"],
};

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d, 12) : null;
  }
  const text = String(value ?? "").trim();
  const br = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (br) {
    const year = Number(br[3]) + (br[3].length === 2 ? 2000 : 0);
    const date = new Date(year, Number(br[2]) - 1, Number(br[1]), 12);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAmount(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").replace(/R\$|\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Number(normalized);
}

export async function readSalesSpreadsheet(file: File): Promise<ImportedSale[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sales: ImportedSale[] = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: "",
    });
    const headerIndex = rows.findIndex((row) => {
      const cells = row.map(normalize);
      return (
        aliases.date.some((a) => cells.includes(a)) && aliases.amount.some((a) => cells.includes(a))
      );
    });
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map(normalize);
    const indexOf = (names: string[]) => headers.findIndex((header) => names.includes(header));
    const indexes = {
      date: indexOf(aliases.date),
      manager: indexOf(aliases.manager),
      collaborator: indexOf(aliases.collaborator),
      amount: indexOf(aliases.amount),
    };
    if (indexes.collaborator < 0) continue;

    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const date = parseDate(row[indexes.date]);
      const amount = parseAmount(row[indexes.amount]);
      const collaborator = String(row[indexes.collaborator] ?? "").trim();
      if (!date || !collaborator || !Number.isFinite(amount) || amount <= 0) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      sales.push({
        row: headerIndex + offset + 2,
        date: `${year}-${month}-${day}`,
        manager: indexes.manager >= 0 ? String(row[indexes.manager] ?? "").trim() : "",
        collaborator,
        amount: Math.round(amount * 100) / 100,
        half: date.getDate() <= 14 ? "quinzena1" : "quinzena2",
      });
    });
  }

  if (!sales.length)
    throw new Error("Não encontrei linhas com Data, Consultor e Valor na planilha.");
  return sales;
}

export const comparableName = normalize;
