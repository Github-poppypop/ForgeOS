/**
 * src/server/semverCompat.ts — Real, dependency-free semantic-version
 * compatibility engine for the plugin marketplace.
 *
 * The existing /api/marketplace/compat only does a regex check for `x.y.z`.
 * This module adds genuine semver logic: parse versions, compare them, and
 * evaluate both caret/tilde ranges and explicit peer/engine constraints so the
 * marketplace can answer "will plugin X (requires engine >=1.2.0, peer foo ^2.0.0)
 * run on host engine 1.4.0 with foo 2.3.1?".
 *
 * Implemented with zero external deps (Node built-ins only).
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseVersion(input: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(input.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split(".") : [],
  };
}

/** Compare a to b. Returns -1 if a<b, 0 if equal, 1 if a>b. Prereleases rank lower. */
export function compareVersions(a: SemVer, b: SemVer): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  // Both same release version: compare prerelease (no prerelease > prerelease).
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const len = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < len; i++) {
    const pa = a.prerelease[i];
    const pb = b.prerelease[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    const na = Number(pa);
    const nb = Number(pb);
    const bothNum = !Number.isNaN(na) && !Number.isNaN(nb);
    if (bothNum) {
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (pa !== pb) {
      return pa < pb ? -1 : 1;
    }
  }
  return 0;
}

export function satisfiesRange(version: SemVer, range: string): boolean {
  const r = range.trim();
  if (r === "*" || r === "latest") return true;

  // Exact
  const exact = parseVersion(r);
  if (exact && !r.startsWith("^") && !r.startsWith("~") && !r.includes(" ")) {
    return compareVersions(version, exact) === 0;
  }

  // Caret ^x.y.z : >= x.y.z and < (x+1).0.0 ; ^0.y.z : >=0.y.z and <0.(y+1).0
  if (r.startsWith("^")) {
    const base = parseVersion(r.slice(1));
    if (!base) return false;
    const upper = { major: base.major + 1, minor: 0, patch: 0, prerelease: [] };
    return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0;
  }

  // Tilde ~x.y.z : >= x.y.z and < x.(y+1).0
  if (r.startsWith("~")) {
    const base = parseVersion(r.slice(1));
    if (!base) return false;
    const upper = { ...base, minor: base.minor + 1, patch: 0 };
    return compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0;
  }

  // Two-sided range: ">=1.2.0 <2.0.0"
  const bounds = r.split(/\s+/).filter(Boolean);
  if (bounds.length >= 2) {
    let ok = true;
    for (const bound of bounds) {
      const operand = bound.match(/^(>=|<=|>|<|=)/);
      if (!operand) return false;
      const ver = parseVersion(bound.slice(operand[1].length));
      if (!ver) return false;
      const opStr = operand[1];
      const c = compareVersions(version, ver);
      if (opStr === ">=" && !(c >= 0)) ok = false;
      else if (opStr === "<=" && !(c <= 0)) ok = false;
      else if (opStr === ">" && !(c > 0)) ok = false;
      else if (opStr === "<" && !(c < 0)) ok = false;
      else if (opStr === "=" && c !== 0) ok = false;
    }
    return ok;
  }

  return false;
}

export interface CompatRequirement {
  /** The host/engine version that must satisfy `range`. */
  engineVersion: string;
  /** Semver range the engine must satisfy (e.g. "^1.2.0"). */
  engineRange: string;
  /** Optional peer dependencies: name -> required range. */
  peers?: Record<string, { version: string; range: string }>;
}

export interface CompatResult {
  compatible: boolean;
  reasons: string[];
}

/**
 * Evaluate whether a plugin (described by engineRange + optional peer deps)
 * is compatible with the host engine and installed peer versions.
 */
export function evaluateCompatibility(req: CompatRequirement): CompatResult {
  const reasons: string[] = [];
  const host = parseVersion(req.engineVersion);
  if (!host) {
    return { compatible: false, reasons: [`invalid host engine version: ${req.engineVersion}`] };
  }
  const rangeBase = parseVersion(req.engineRange.replace(/^[\^~]/, ""));
  if (!rangeBase) {
    return { compatible: false, reasons: [`invalid engine range: ${req.engineRange}`] };
  }
  if (!satisfiesRange(host, req.engineRange)) {
    reasons.push(
      `engine ${req.engineVersion} does not satisfy required range ${req.engineRange}`
    );
  }
  if (req.peers) {
    for (const [name, peer] of Object.entries(req.peers)) {
      const pv = parseVersion(peer.version);
      if (!pv) {
        reasons.push(`invalid installed peer version for ${name}: ${peer.version}`);
        continue;
      }
      if (!satisfiesRange(pv, peer.range)) {
        reasons.push(`peer ${name}@${peer.version} does not satisfy ${peer.range}`);
      }
    }
  }
  return { compatible: reasons.length === 0, reasons };
}
