import * as XLSX from "xlsx";
import {
  getDocument,
  GlobalWorkerOptions,
  OPS,
  Util,
  type PDFPageProxy,
  type TextItem,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type ImportedSale = {
  row: number;
  date: string;
  manager: string;
  collaborator: string;
  amount: number;
  half: "quinzena1" | "quinzena2";
  status: "ativa" | "cancelada";
};

type StyledCell = XLSX.CellObject & {
  s?: { font?: { color?: { rgb?: string } }; fill?: { fgColor?: { rgb?: string } } };
};

const isRedHex = (rgb?: string) => {
  const hex = rgb?.replace(/^#/, "").slice(-6);
  if (!hex || hex.length !== 6) return false;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return red > 140 && red - green > 35 && red - blue > 35;
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
  const text = String(value ?? "")
    .trim()
    .replace(/([/.-])\1+/g, "$1");
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
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
    cellStyles: true,
  });
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
      if (!date || !Number.isFinite(amount) || amount <= 0) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const worksheetRow = headerIndex + offset + 1;
      const cancelled = row.some((_, column) => {
        const cell = workbook.Sheets[sheetName][
          XLSX.utils.encode_cell({ r: worksheetRow, c: column })
        ] as StyledCell | undefined;
        return isRedHex(cell?.s?.font?.color?.rgb) || isRedHex(cell?.s?.fill?.fgColor?.rgb);
      });
      sales.push({
        row: headerIndex + offset + 2,
        date: `${year}-${month}-${day}`,
        manager: indexes.manager >= 0 ? String(row[indexes.manager] ?? "").trim() : "",
        collaborator,
        amount: Math.round(amount * 100) / 100,
        half: date.getDate() <= 14 ? "quinzena1" : "quinzena2",
        status: cancelled ? "cancelada" : "ativa",
      });
    });
  }

  if (!sales.length)
    throw new Error("Não encontrei linhas com Data, Consultor e Valor na planilha.");
  return sales;
}

type PositionedText = { text: string; x: number; y: number };

type PdfRegion = { minX: number; maxX: number; minY: number; maxY: number };

async function redPdfRegions(page: PDFPageProxy): Promise<PdfRegion[]> {
  const operators = await page.getOperatorList();
  let transform = [1, 0, 0, 1, 0, 0];
  const transforms: number[][] = [];
  let fillColor = "";
  const regions: PdfRegion[] = [];
  const point = (x: number, y: number) => [
    transform[0] * x + transform[2] * y + transform[4],
    transform[1] * x + transform[3] * y + transform[5],
  ];

  operators.fnArray.forEach((operator, index) => {
    const args = operators.argsArray[index];
    if (operator === OPS.save) transforms.push([...transform]);
    else if (operator === OPS.restore) transform = transforms.pop() ?? transform;
    else if (operator === OPS.transform) transform = Util.transform(transform, args as number[]);
    else if (operator === OPS.setFillRGBColor) fillColor = String(args?.[0] ?? "").toLowerCase();
    else if (operator === OPS.constructPath && fillColor === "#ff0000") {
      const bounds = args?.[2] as ArrayLike<number> | undefined;
      if (!bounds || bounds.length < 4) return;
      const first = point(bounds[0], bounds[1]);
      const second = point(bounds[2], bounds[3]);
      regions.push({
        minX: Math.min(first[0], second[0]),
        maxX: Math.max(first[0], second[0]),
        minY: Math.min(first[1], second[1]),
        maxY: Math.max(first[1], second[1]),
      });
    }
  });
  return regions;
}

const isInRedRegion = (regions: PdfRegion[], y: number, side: "left" | "right") => {
  const centerX = side === "left" ? 240 : 620;
  return regions.some(
    (region) =>
      centerX >= region.minX &&
      centerX <= region.maxX &&
      y >= region.minY - 1 &&
      y <= region.maxY + 1,
  );
};

function pdfRow(items: PositionedText[], row: number, side: "left" | "right") {
  const columns =
    side === "left"
      ? { date: [45, 75], manager: [75, 100], collaborator: [100, 130], amount: [315, 375] }
      : { date: [450, 485], manager: [490, 520], collaborator: [520, 550], amount: [710, 755] };
  const valueAt = ([from, to]: number[]) =>
    items
      .filter((item) => item.y === row && item.x >= from && item.x < to && item.text.trim())
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text.trim())
      .join(" ")
      .trim();
  return {
    date: valueAt(columns.date),
    manager: valueAt(columns.manager),
    collaborator: valueAt(columns.collaborator),
    amount: valueAt(columns.amount),
  };
}

async function readSalesPdf(file: File): Promise<ImportedSale[]> {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const sales: ImportedSale[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const redRegions = await redPdfRegions(page);
    const content = await page.getTextContent();
    const items: PositionedText[] = content.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }));
    const rows = [...new Set(items.map((item) => item.y))].sort((a, b) => b - a);
    for (const side of ["left", "right"] as const) {
      for (const row of rows) {
        const values = pdfRow(items, row, side);
        const date = parseDate(values.date);
        const amount = parseAmount(values.amount);
        if (!date || !Number.isFinite(amount) || amount <= 0) continue;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        sales.push({
          row: pageNumber * 10_000 + row,
          date: `${year}-${month}-${day}`,
          manager: values.manager,
          collaborator: values.collaborator,
          amount: Math.round(amount * 100) / 100,
          half: date.getDate() <= 14 ? "quinzena1" : "quinzena2",
          status: isInRedRegion(redRegions, row, side) ? "cancelada" : "ativa",
        });
      }
    }
  }
  if (!sales.length) throw new Error("Não encontrei Data, Consultor e Valor nas tabelas do PDF.");
  return sales;
}

export async function readSalesFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    ? readSalesPdf(file)
    : readSalesSpreadsheet(file);
}

export const comparableName = normalize;
