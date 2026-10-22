// Supabase reports success when row security quietly matches no rows (no permission, another unit,
// or the row changed). Pair writes with .select("id") and pass the result here.
export function checkSaved(r: { data: unknown[] | null; error: { message: string } | null }, expected = 1) {
  if (r.error) throw r.error;
  const n = r.data?.length ?? 0;
  if (n === 0) throw new Error("That didn't save. You may not have permission for it, or it changed. Reload and try again.");
  if (n < expected) throw new Error(`Only ${n} of ${expected} saved. Reload to see which ones didn't.`);
}
