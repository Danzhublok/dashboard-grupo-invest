import assert from "node:assert/strict";
import test from "node:test";
import { salesForImportReplacement } from "../src/lib/sales-import-scope.ts";

function database(rows) {
  return {
    from(table) {
      assert.equal(table, "sales");
      let selected = rows;
      const query = {
        select() {
          return query;
        },
        gte(column, value) {
          selected = selected.filter((r) => Date.parse(r[column]) >= Date.parse(value));
          return query;
        },
        lt(column, value) {
          selected = selected.filter((r) => Date.parse(r[column]) < Date.parse(value));
          return query;
        },
        eq() {
          throw new Error("Replacement must not filter by legacy half");
        },
        then(resolve) {
          return Promise.resolve({ data: selected, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

test("October import includes all three misclassified cancellations without touching half 2 dates", async () => {
  const mistakes = [153.79, 169270.75, 76893.82].map((amount, i) => ({
    id: `old-${i}`,
    amount,
    half: "quinzena2",
    sold_at: "2026-10-08T15:00:00Z",
  }));
  const rows = [
    ...mistakes,
    { id: "sept", sold_at: "2026-10-01T02:59:59Z" },
    { id: "last-first", sold_at: "2026-10-15T02:59:59Z" },
    { id: "first-second", sold_at: "2026-10-15T03:00:00Z" },
  ];
  const { data } = await salesForImportReplacement(database(rows), "2026-10", "quinzena1");
  assert.deepEqual(
    data.map((r) => r.id),
    ["old-0", "old-1", "old-2", "last-first"],
  );
  assert.equal(
    mistakes.reduce((s, r) => s + Math.round(r.amount * 100), 0),
    24631836,
  );
  assert.equal(480548309 - 24631836, 455916473);
});

test("second half retains the first half and handles year rollover", async () => {
  const rows = [
    { id: "first-half", sold_at: "2026-12-14T15:00:00Z" },
    { id: "second-half", sold_at: "2027-01-01T02:59:59Z", half: "quinzena1" },
    { id: "next-month", sold_at: "2027-01-01T03:00:00Z" },
  ];
  const { data } = await salesForImportReplacement(database(rows), "2026-12", "quinzena2");
  assert.deepEqual(
    data.map((r) => r.id),
    ["second-half"],
  );
});
