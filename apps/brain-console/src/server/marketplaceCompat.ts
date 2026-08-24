// src/server/marketplaceCompat.ts
// Capability compatibility checks for marketplace plugins (backlog #42).
//
// Before a plugin is installed the console must decide whether the host can
// actually run it. Previously `/api/marketplace/compat` only asserted that a
// name was present and the version looked like semver -- which meant an
// incompatible plugin (needing capabilities or an engine the host does not
// provide) reported "Compatible" and installed anyway.
//
// This module is pure and dependency-free so it can be unit tested without
// booting Express: it takes a candidate plugin descriptor plus a host
// environment and returns a structured report.
//
// Design rule -- PERMISSIVE BY DEFAULT: a plugin that declares nothing
// (`engines`/`requires`/`conflicts` absent) is compatible. Legacy registry
// entries carry no declarations, so gating installs on this report must not
// break them. Only an EXPLICIT, UNSATISFIED declaration blocks an install.

/** Capability ids the brain-console runtime provides to plugins. */
export const HOST_CAPABILITIES: readonly string[] = [
  "console:panels",
  "console:routes",
  "storage:local",
  "storage:json",
  "net:fetch",
  "sse:stream",
  "ws:stream",
  "registry:read",
  "registry:write",
  "telemetry:write",
  "audit:write",
  "agents:spawn",
];

export interface HostEnvironment {
  /** Host console version, e.g. "1.0.0". */
  engine: string;
  /** Capability ids the host provides. */
  capabilities: string[];
  /** Host node version without a leading "v". */
  node: string;
  /** Names of already-installed plugins (used for conflict detection). */
  installed: string[];
}

export interface CompatCandidate {
  name?: unknown;
  version?: unknown;
  /** Either a range string (treated as the forgeos range) or a per-engine map. */
  engines?: unknown;
  /** Alias for `engines.forgeos`. */
  minEngine?: unknown;
  /** Capability ids the plugin needs from the host. */
  requires?: unknown;
  /** Capability ids the plugin itself provides (informational). */
  capabilities?: unknown;
  /** Plugin names this plugin cannot co-exist with. */
  conflicts?: unknown;
}

export type Severity = "error" | "warn" | "info";

export interface CompatCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  severity: Severity;
}

export interface CompatReport {
  name: string;
  version: string;
  /** False only when an error-severity check failed. */
  compatible: boolean;
  message: string;
  checks: CompatCheck[];
  missingCapabilities: string[];
  conflicts: string[];
  reasons: string[];
  host: HostEnvironment;
}

interface Semver {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)/;

/** Parse "1.2.3" (and "1.2.3-beta.1", "v1.2.3") into its numeric parts. */
export function parseSemver(value: unknown): Semver | null {
  const raw = String(value ?? "").trim().replace(/^[v=]+/, "");
  const m = SEMVER_RE.exec(raw);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** -1 when a < b, 0 when equal, 1 when a > b. */
export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

function satisfiesComparator(version: Semver, comparator: string): boolean {
  const token = comparator.trim();
  if (!token || token === "*" || token.toLowerCase() === "x" || token.toLowerCase() === "latest") return true;

  const opMatch = /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/.exec(token);
  if (!opMatch) return false;
  const op = opMatch[1] ?? "=";
  const target = parseSemver(opMatch[2]);
  if (!target) return false;

  const cmp = compareSemver(version, target);
  switch (op) {
    case ">=":
      return cmp >= 0;
    case ">":
      return cmp > 0;
    case "<=":
      return cmp <= 0;
    case "<":
      return cmp < 0;
    case "^":
      // Compatible-with: same major (or same minor when major is 0).
      if (cmp < 0) return false;
      if (target.major > 0) return version.major === target.major;
      if (target.minor > 0) return version.major === 0 && version.minor === target.minor;
      return version.major === 0 && version.minor === 0;
    case "~":
      // Approximately-equivalent: same major.minor.
      return cmp >= 0 && version.major === target.major && version.minor === target.minor;
    default:
      return cmp === 0;
  }
}

/**
 * Does `version` satisfy `range`? Supports `*`, exact, `>=`, `>`, `<=`, `<`,
 * `^`, `~`, space-separated AND (">=1.0.0 <2.0.0") and `||` OR groups.
 * An empty/absent range is satisfied by anything (permissive default).
 */
export function satisfiesRange(version: unknown, range: unknown): boolean {
  const rangeStr = String(range ?? "").trim();
  if (!rangeStr) return true;
  const parsed = parseSemver(version);
  if (!parsed) return false;
  return rangeStr.split("||").some((group) => {
    const comparators = group.trim().split(/\s+/).filter(Boolean);
    if (!comparators.length) return true;
    return comparators.every((c) => satisfiesComparator(parsed, c));
  });
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function engineRanges(candidate: CompatCandidate): { forgeos: string; node: string } {
  const engines = candidate.engines;
  let forgeos = String(candidate.minEngine ?? "").trim();
  let node = "";
  if (typeof engines === "string") {
    forgeos = forgeos || engines.trim();
  } else if (engines && typeof engines === "object") {
    const map = engines as Record<string, unknown>;
    forgeos = forgeos || String(map.forgeos ?? map["brain-console"] ?? map.console ?? "").trim();
    node = String(map.node ?? "").trim();
  }
  return { forgeos, node };
}

/** Build the host descriptor, with optional overrides (tests, future config). */
export function hostEnvironment(overrides: Partial<HostEnvironment> = {}): HostEnvironment {
  const nodeVersion = typeof process !== "undefined" && process.versions?.node ? process.versions.node : "0.0.0";
  return {
    engine: overrides.engine ?? "1.0.0",
    capabilities: overrides.capabilities ? [...overrides.capabilities] : [...HOST_CAPABILITIES],
    node: overrides.node ?? nodeVersion,
    installed: overrides.installed ? [...overrides.installed] : [],
  };
}

/**
 * Run every compatibility gate against the host. `compatible` is false only
 * when an error-severity check fails, so warnings (e.g. an unknown capability
 * the plugin merely *provides*) never block an install.
 */
export function checkCompatibility(candidate: CompatCandidate, host: HostEnvironment = hostEnvironment()): CompatReport {
  const name = String(candidate.name ?? "").trim();
  const version = String(candidate.version ?? "").trim();
  const checks: CompatCheck[] = [];

  checks.push({
    id: "name",
    label: "Plugin name present",
    ok: name.length > 0,
    detail: name ? name : "no plugin name supplied",
    severity: "error",
  });

  const parsedVersion = parseSemver(version);
  checks.push({
    id: "version",
    label: "Version is semver (x.y.z)",
    ok: parsedVersion !== null,
    detail: parsedVersion ? version : `"${version}" is not semver`,
    severity: "error",
  });

  const { forgeos, node } = engineRanges(candidate);

  const engineOk = satisfiesRange(host.engine, forgeos);
  checks.push({
    id: "engine",
    label: "Host console satisfies required engine range",
    ok: engineOk,
    detail: forgeos
      ? `host ${host.engine} ${engineOk ? "satisfies" : "does not satisfy"} "${forgeos}"`
      : "no engine range declared",
    severity: "error",
  });

  const nodeOk = satisfiesRange(host.node, node);
  checks.push({
    id: "node",
    label: "Host node satisfies required node range",
    ok: nodeOk,
    detail: node ? `node ${host.node} ${nodeOk ? "satisfies" : "does not satisfy"} "${node}"` : "no node range declared",
    severity: "error",
  });

  const required = stringList(candidate.requires);
  const hostCaps = new Set(host.capabilities);
  const missingCapabilities = required.filter((cap) => !hostCaps.has(cap));
  checks.push({
    id: "capabilities",
    label: "Host provides all required capabilities",
    ok: missingCapabilities.length === 0,
    detail: required.length
      ? missingCapabilities.length
        ? `missing: ${missingCapabilities.join(", ")}`
        : `all ${required.length} capability requirement(s) satisfied`
      : "no capabilities required",
    severity: "error",
  });

  const declaredConflicts = stringList(candidate.conflicts);
  const installedSet = new Set(host.installed.map((n) => n.toLowerCase()));
  const conflicts = declaredConflicts.filter((c) => installedSet.has(c.toLowerCase()));
  checks.push({
    id: "conflicts",
    label: "No conflicting plugin installed",
    ok: conflicts.length === 0,
    detail: conflicts.length
      ? `conflicts with installed: ${conflicts.join(", ")}`
      : declaredConflicts.length
        ? "declared conflicts are not installed"
        : "no conflicts declared",
    severity: "error",
  });

  const provided = stringList(candidate.capabilities);
  const unknownProvided = provided.filter((cap) => !hostCaps.has(cap));
  checks.push({
    id: "provides",
    label: "Provided capabilities recognised by host",
    ok: unknownProvided.length === 0,
    detail: provided.length
      ? unknownProvided.length
        ? `host does not recognise: ${unknownProvided.join(", ")} (informational)`
        : `provides ${provided.join(", ")}`
      : "provides nothing extra",
    severity: "warn",
  });

  const failures = checks.filter((c) => !c.ok && c.severity === "error");
  const compatible = failures.length === 0;
  const reasons = failures.map((f) => f.detail);

  return {
    name,
    version,
    compatible,
    message: compatible
      ? "Compatible"
      : `Incompatible: ${reasons.join("; ")}`,
    checks,
    missingCapabilities,
    conflicts,
    reasons,
    host,
  };
}
