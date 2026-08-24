// Column ordering helpers for reorderable tables (closes next-50 Batch B #19:
// "Panel resize + column reorder persistence"). Pure + browser-agnostic so they
// can be unit-tested without a DOM; the React layer persists the order to
// localStorage so it survives reloads.

/** Move the item at `from` to position `to` in `cols`. Returns a NEW array and
 *  never mutates the input. Out-of-range indices are clamped (no-op). */
export function reorderColumns<T>(cols: T[], from: number, to: number): T[] {
  const next = cols.slice();
  if (from < 0 || from >= next.length) return next;
  if (to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const KEY = 'forgeos.appstore.colOrder';

/** Load a persisted column order, reconciled against `defaults`. Unknown or
 *  dropped columns are filtered out and any missing defaults are appended, so
 *  the stored order can never drift out of sync with the table schema. */
export function loadColumnOrder(defaults: string[]): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return defaults.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults.slice();
    const filtered = parsed.filter(
      (c: unknown) => typeof c === 'string' && (defaults as string[]).includes(c)
    ) as string[];
    const missing = (defaults as string[]).filter((c) => !filtered.includes(c));
    return [...filtered, ...missing];
  } catch {
    return defaults.slice();
  }
}

export function saveColumnOrder(order: string[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(order));
  } catch {
    /* ignore quota / unavailable storage */
  }
}
