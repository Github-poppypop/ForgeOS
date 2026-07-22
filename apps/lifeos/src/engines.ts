// LifeOS Engine runtime stubs — pure transforms over the Knowledge Universe.
// Each engine: state' = Engine(state, input). See docs/ARCHITECTURE.md §5.
// Runtime substrate: gbrain (entity registry, event ledger, fact store, graph).

export type MemoryKind = "episodic" | "semantic" | "procedural";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  source: string;
  timestamp: string; // ISO
}

export interface BrainDNA {
  id: string;
  version: number;
  traits: { dimension: string; score: number }[];
  values: { id: string; label: string; rank: number }[];
  preferences: { id: string; category: string; value: string }[];
  constraints: { id: string; rule: string; severity: "hard" | "soft" }[];
  updatedAt: string;
}

export interface Mission {
  id: string;
  statement: string;
  principles: string[];
  horizon: "life" | "year" | "quarter";
}

export interface Goal {
  id: string;
  missionRef?: string;
  parentGoalId?: string;
  title: string;
  status: "active" | "blocked" | "done" | "abandoned";
  subGoals: string[];
  agentRefs: string[];
}

// --- Memory Engine -----------------------------------------------------
// KU' = ingest(KU, event)
export function ingest(ku: MemoryRecord[], event: Omit<MemoryRecord, "id" | "timestamp">): MemoryRecord[] {
  const record: MemoryRecord = {
    ...event,
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  return [...ku, record];
}

// context = retrieve(KU, query, slice)
export function retrieve(ku: MemoryRecord[], query: string, slice?: string): MemoryRecord[] {
  // Stub: semantic + temporal ranking deferred to gbrain vector store.
  // For now: naive substring filter + recency sort.
  const q = query.toLowerCase();
  return ku
    .filter((m) => m.content.toLowerCase().includes(q))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// --- Mission Engine ----------------------------------------------------
// Mission' = reconcile(Mission, DNA, input)
export function reconcile(
  mission: Mission,
  dna: BrainDNA,
  proposed: Partial<Mission>
): { ok: true; mission: Mission } | { ok: false; conflict: string } {
  // Hard constraint: mission must not breach DNA constraints.
  const conflicting = dna.constraints.filter(
    (c) => c.severity === "hard" && JSON.stringify(proposed).toLowerCase().includes(c.rule.toLowerCase())
  );
  if (conflicting.length > 0) {
    return { ok: false, conflict: `Breaches DNA constraint: ${conflicting.map((c) => c.rule).join(", ")}` };
  }
  return { ok: true, mission: { ...mission, ...proposed } as Mission };
}

// --- Goal Engine -------------------------------------------------------
// GoalGraph' = decompose(goal, mission, dna)
export function decompose(goal: Goal, mission: Mission, dna: BrainDNA): Goal[] {
  // Stub: one level of sub-goals. Real impl uses LLM + DNA/mission guardrails.
  const sub: Goal = {
    id: `goal_${Date.now()}_sub`,
    parentGoalId: goal.id,
    title: `Sub-goal of: ${goal.title}`,
    status: "active",
    subGoals: [],
    agentRefs: [],
  };
  return [sub];
}

// --- Agent Engine ------------------------------------------------------
export interface Mandate {
  allowedActions: string[];
  forbiddenActions: string[];
  dnaRef: string;
}

// actions = plan(agent, goal, ku)
export function plan(mandate: Mandate, goal: Goal, ku: MemoryRecord[]): string[] {
  // Stub: returns in-mandate steps. Out-of-mandate => escalate (caller handles).
  return [`plan:${goal.title}`, `context:${ku.length} memories`];
}
