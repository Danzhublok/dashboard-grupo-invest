import type { SupabaseClient } from "@supabase/supabase-js";

// sold_at is authoritative when replacing a period. Old entries may have an
// incorrectly selected half and still need to be superseded by the new file.
export function salesForImportReplacement(client: SupabaseClient, month: string, half: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const start = `${month}-${half === "quinzena1" ? "01" : "15"}T00:00:00-03:00`;
  const end =
    half === "quinzena1" ? `${month}-15T00:00:00-03:00` : `${nextMonth}-01T00:00:00-03:00`;
  return client
    .from("sales")
    .select("id, status, cancellation_reason, cancelled_at")
    .gte("sold_at", start)
    .lt("sold_at", end);
}
