import * as XLSX from "xlsx";
import {
  getDocument,
  GlobalWorkerOptions,
  OPS,
  Util,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

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

type PdfVerticalLine = { x: number; minY: number; maxY: number };

type PdfRegion = { minX: number; maxX: number; minY: number; maxY: number };

async function pdfTableGeometry(page: PDFPageProxy) {
  const operators = await page.getOperatorList();
  let transform = [1, 0, 0, 1, 0, 0];
  const transforms: number[][] = [];
  let fillColor = "";
  const regions: PdfRegion[] = [];
  const verticalLines: PdfVerticalLine[] = [];
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
    else if (operator === OPS.constructPath) {
      // PDF.js packs each path as move/line/curve commands followed by coordinates.
      const paths = args?.[1] as ArrayLike<number>[] | undefined;
      for (const path of paths ?? []) {
        let previous: number[] | undefined;
        for (let offset = 0; offset < path.length;) {
          const command = path[offset++];
          if (command === 4) {
            previous = undefined;
            continue;
          }
          if (command === 2) {
            offset += 6;
            previous = undefined;
            continue;
          }
          if (command === 3) {
            offset += 4;
            previous = undefined;
            continue;
          }
          if (command !== 0 && command !== 1) break;
          const current = point(path[offset++], path[offset++]);
          if (command === 1 && previous && Math.abs(current[0] - previous[0]) < 0.5) {
            verticalLines.push({
              x: current[0],
              minY: Math.min(current[1], previous[1]),
              maxY: Math.max(current[1], previous[1]),
            });
          }
          previous = current;
        }
      }
      if (fillColor !== "#ff0000") return;
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
  return { redRegions: regions, verticalLines };
}

const isInRedRegion = (regions: PdfRegion[], y: number, centerX: number) => {
  return regions.some(
    (region) =>
      centerX >= region.minX &&
      centerX <= region.maxX &&
      y >= region.minY - 1 &&
      y <= region.maxY + 1,
  );
};

function singleTablePdfRows(
  items: PositionedText[],
  regions: PdfRegion[],
  verticalLines: PdfVerticalLine[],
  pageNumber: number,
) {
  const requiredLabels = [
    "data",
    "gerente",
    "consultor",
    "consorciado",
    "clientepagante",
    "valordocredito",
    "valordeentrada",
  ];
  const headers = [...new Set(items.map((item) => item.y))]
    .sort((a, b) => b - a)
    .flatMap((header) => {
      const groups: PositionedText[][] = [];
      for (const item of items
        .filter((candidate) => candidate.y === header)
        .sort((a, b) => a.x - b.x)) {
        if (normalize(item.text) === "data") groups.push([item]);
        else groups.at(-1)?.push(item);
      }
      return groups
        .filter((group) => {
          const labels = group.map((item) => normalize(item.text));
          return requiredLabels.every((label) => labels.includes(label));
        })
        .map((heading) => ({ header, heading }));
    });
  if (!headers.length) return null;

  return headers.flatMap(({ header, heading }, tableIndex) => {
    const xOf = (label: string) => heading.find((item) => normalize(item.text) === label)!.x;
    const dateX = xOf("data");
    const managerX = xOf("gerente");
    const collaboratorX = xOf("consultor");
    const customerX = xOf("consorciado");
    const payerX = xOf("clientepagante");
    const amountX = xOf("valordocredito");
    const entryX = xOf("valordeentrada");
    const boundary = (left: number, right: number) => (left + right) / 2;
    // Titles can be centered in cells of very different widths. Use the drawn
    // cell borders instead of the midpoint between title starting positions.
    const edges = [
      ...new Set(
        verticalLines
          .filter((line) => header >= line.minY - 1 && header <= line.maxY + 1)
          .map((line) => line.x),
      ),
    ].sort((a, b) => a - b);
    const columnAt = (x: number, fallback: number[]) => {
      const from = edges.filter((edge) => edge < x).at(-1);
      const to = edges.find((edge) => edge > x);
      return from !== undefined && to !== undefined ? [from, to] : fallback;
    };
    const columns = {
      date: columnAt(dateX, [-Infinity, boundary(dateX, managerX)]),
      manager: columnAt(managerX, [boundary(dateX, managerX), boundary(managerX, collaboratorX)]),
      collaborator: columnAt(collaboratorX, [
        boundary(managerX, collaboratorX),
        boundary(collaboratorX, customerX),
      ]),
      amount: columnAt(amountX, [boundary(payerX, amountX), boundary(amountX, entryX)]),
    };
    const valueAt = (row: number, [from, to]: number[]) =>
      items
        .filter((item) => item.y === row && item.x >= from && item.x < to && item.text.trim())
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text.trim())
        .join(" ");

    const tableRows = [...new Set(items.filter((item) => item.y < header).map((item) => item.y))]
      .sort((a, b) => b - a)
      .flatMap((row) => {
        const date = parseDate(valueAt(row, columns.date));
        const amount = parseAmount(valueAt(row, columns.amount));
        const collaborator = valueAt(row, columns.collaborator);
        if (!date || !Number.isFinite(amount) || amount <= 0) return [];
        return [
          {
            sourceRow: row,
            row: pageNumber * 10_000 + row * headers.length + tableIndex,
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
            manager: valueAt(row, columns.manager),
            collaborator,
            amount: Math.round(amount * 100) / 100,
            half: date.getDate() <= 14 ? ("quinzena1" as const) : ("quinzena2" as const),
            status: isInRedRegion(regions, row, collaboratorX)
              ? ("cancelada" as const)
              : ("ativa" as const),
          },
        ];
      });
    const footerTotals = [
      ...new Set(
        items
          .filter(
            (item) =>
              tableRows.length > 0 &&
              item.y < Math.min(...tableRows.map((sale) => sale.sourceRow)),
          )
          .map((item) => item.y),
      ),
    ]
      .sort((a, b) => b - a)
      .map((row) => parseAmount(valueAt(row, columns.amount)))
      .filter((amount) => Number.isFinite(amount) && amount > 0);

    if (footerTotals.length >= 2) {
      const cents = (amount: number) => Math.round(amount * 100);
      const formatBRL = (amount: number) =>
        (cents(amount) / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      const gross = tableRows.reduce((total, sale) => total + cents(sale.amount), 0);
      const net = tableRows.reduce(
        (total, sale) => total + (sale.status === "ativa" ? cents(sale.amount) : 0),
        0,
      );
      const reportedGross = cents(footerTotals[0]);
      const reportedNet = cents(footerTotals[1]);

      if (Math.abs(gross - reportedGross) > 1 || Math.abs(net - reportedNet) > 1) {
        throw new Error(
          `Os valores lidos nesta tabela não conferem com o PDF. Bruto: ${formatBRL(gross / 100)} (PDF: ${formatBRL(reportedGross / 100)}); líquido: ${formatBRL(net / 100)} (PDF: ${formatBRL(reportedNet / 100)}). Revise a planilha antes de importar.`,
        );
      }
    }

    return tableRows.map(({ sourceRow: _sourceRow, ...sale }) => sale);
  });
}

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
    const { redRegions, verticalLines } = await pdfTableGeometry(page);
    const content = await page.getTextContent();
    const items: PositionedText[] = content.items
      .filter((item): item is Extract<typeof item, { str: string }> => "str" in item)
      .map((item) => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }));
    const singleTableSales = singleTablePdfRows(items, redRegions, verticalLines, pageNumber);
    if (singleTableSales) {
      sales.push(...singleTableSales);
      continue;
    }
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
          status: isInRedRegion(redRegions, row, side === "left" ? 240 : 620)
            ? "cancelada"
            : "ativa",
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

// Accept accents and abbreviated full names, but never guess a different person.
export function importedNameMatches(systemName: string, importedName: string) {
  const imported = comparableName(importedName);
  if (!imported) return false;
  if (comparableName(systemName) === imported) return true;
  const importedWords = importedName.trim().split(/\s+/).length;
  return (
    comparableName(systemName.trim().split(/\s+/).slice(0, importedWords).join(" ")) === imported
  );
}
