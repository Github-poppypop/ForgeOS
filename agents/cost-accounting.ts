/**
 * agents/cost-accounting.ts — Token/cost accounting per role
 */
export interface CostEntry {
  role: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  ts: string;
}

const store = new Map<string, CostEntry[]>();
const MAX = 2000;

export function recordCost(entry: Omit<CostEntry, 'ts'>) {
  const key = entry.role || 'unknown';
  const list = store.get(key) || [];
  list.push({ ...entry, ts: new Date().toISOString() });
  if (list.length > MAX) list.splice(0, list.length - MAX);
  store.set(key, list);
}

export function getCostByRole(role?: string) {
  if (role) {
    const list = store.get(role) || [];
    const tokensIn = list.reduce((s, e) => s + (e.tokensIn || 0), 0);
    const tokensOut = list.reduce((s, e) => s + (e.tokensOut || 0), 0);
    const cost = list.reduce((s, e) => s + (e.cost || 0), 0);
    return { role, count: list.length, tokensIn, tokensOut, cost };
  }
  const result: Record<string, { count: number; tokensIn: number; tokensOut: number; cost: number }> = {};
  for (const [role, list] of store.entries()) {
    result[role] = {
      count: list.length,
      tokensIn: list.reduce((s, e) => s + (e.tokensIn || 0), 0),
      tokensOut: list.reduce((s, e) => s + (e.tokensOut || 0), 0),
      cost: list.reduce((s, e) => s + (e.cost || 0), 0),
    };
  }
  return result;
}
