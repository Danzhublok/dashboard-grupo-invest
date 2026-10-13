import assert from "node:assert/strict";
import test from "node:test";
import { brl, deduplicarCancelamentosImportados } from "../src/lib/reps.ts";

const sale = (id, valor, extra = {}) => ({
  id,
  representationId: "rep",
  collaboratorId: id,
  valor,
  quinzena: "quinzena1",
  data: "2026-10-02T15:00:00Z",
  status: "cancelada",
  motivoCancelamento: "Venda cancelada - marcada em vermelho",
  canceladaEm: "2026-10-13T15:00:00Z",
  ...extra,
});
const current = [sale("plicia", 65577.45), sale("pablo", 789930.18), sale("helida", 402496)];

test("full import supersedes old manual cancellations and restores the PDF totals", () => {
  const old = [1, 2, 3].map((n) =>
    sale(`old-${n}`, n * 100, {
      motivoCancelamento: "Cancelamento registrado manualmente",
      canceladaEm: "2026-10-12T15:00:00Z",
    }),
  );
  const result = deduplicarCancelamentosImportados([...old, ...current]);
  assert.equal(result.length, 3);
  const cancelled = result.reduce((s, r) => s + Math.round(r.valor * 100), 0);
  assert.equal(cancelled, 125800363);
  assert.equal(cancelled + 330116110, 455916473);
  assert.match(brl(4559164.73), /4\.559\.164,73/);
});

test("keeps manual cancellations registered after the import and in other periods", () => {
  const after = sale("after", 100, {
    motivoCancelamento: "Cliente desistiu",
    canceladaEm: "2026-10-13T16:00:00Z",
  });
  const other = sale("other", 200, {
    data: "2026-09-02T15:00:00Z",
    motivoCancelamento: "Cliente desistiu",
    canceladaEm: "2026-09-12T15:00:00Z",
  });
  const unknown = sale("unknown", 300, {
    motivoCancelamento: "Cliente desistiu",
    canceladaEm: undefined,
  });
  assert.equal(deduplicarCancelamentosImportados([...current, after, other, unknown]).length, 6);
});

test("does not merge equal amounts belonging to different consultants", () => {
  assert.equal(deduplicarCancelamentosImportados([sale("a", 100), sale("b", 100)]).length, 2);
});

test("excludes substituted records and earlier imported batches", () => {
  const replaced = sale("replaced", 100, { motivoCancelamento: "Substituída por nova importação" });
  const oldImport = sale("old-import", 100, { canceladaEm: "2026-10-12T15:00:00Z" });
  assert.equal(deduplicarCancelamentosImportados([...current, replaced, oldImport]).length, 3);
});
