/**
 * agents/guardrails.ts — Constitutional Guardrails Enforcement
 *
 * Implements the ORG.md §3 delegation rules as runtime checks.
 * Use this module in the agent runtime to reject or escalate actions
 * before they execute.
 *
 * Rules enforced:
 *  1. single-reporting-line
 *  2. mandate-boundary
 *  3. escalate-dont-bypass
 *  4. delegate-dont-abdicate
 *  5. write-it-down
 *  6. reversibility-check
 *  7. autonomy-ceiling
 *  8. no-silent-failure
 */

import {
  AuthorityTier,
  CsuiteRole,
  DelegationRules,
  GuardrailRule,
  GuardrailViolation,
  PolicyContext,
} from '../packages/shared/src/types';

import * as path from 'node:path';

/* ─────────────────────────────────────────────
 * Action classification
 * ───────────────────────────────────────────── */

export type ActionCategory =
  | 'reversible'
  | 'irreversible'
  | 'cross-domain'
  | 'delegated'
  | 'escalation'
  | 'knowledge-write';

export interface ProposedAction {
  id: string;
  agentId: string;
  role: CsuiteRole;
  tier: AuthorityTier;
  description: string;
  category: ActionCategory;
  targetDomain?: CsuiteRole;       // cross-domain target
  delegateTo?: string;             // sub-agent id
  requiresRecord?: boolean;        // should this be written down?
}

export interface GuardrailResult {
  allowed: boolean;
  violations: GuardrailViolation[];
  mustEscalateTo?: CsuiteRole | 'Board';
  mustWriteDecision?: boolean;
}

/* ─────────────────────────────────────────────
 * Guardrails engine
 * ───────────────────────────────────────────── */

export class Guardrails {
  constructor(private readonly ctx: PolicyContext) {}

  /**
   * Evaluate a proposed action against all ORG §3 rules.
   * Returns `allowed: true` only when every rule passes.
   */
  evaluate(action: ProposedAction): GuardrailResult {
    const violations: GuardrailViolation[] = [];
    let mustEscalateTo: CsuiteRole | 'Board' | undefined;
    let mustWriteDecision = false;

    // 1. Autonomy ceiling — agent cannot act above its tier
    if (action.tier === 'read' && action.category !== 'reversible') {
      violations.push({
        rule: 'autonomy-ceiling',
        agent: action.agentId,
        action: action.description,
        detail: `Agent has tier=read; cannot execute ${action.category} actions.`,
        severity: 'error',
      });
    }

    // 2. Mandate boundary — domain crossing needs a request
    if (
      action.category === 'cross-domain' &&
      action.targetDomain &&
      !this.ctx.requiresRequest.includes(action.targetDomain)
    ) {
      violations.push({
        rule: 'mandate-boundary',
        agent: action.agentId,
        action: action.description,
        detail: `Cross-domain action into ${action.targetDomain} requires formal request.`,
        severity: 'error',
      });
    }

    // 3. Irreversibility check — deploys/deletes/spend need sign-off.
    // A non-admin agent may not perform irreversible actions; they must be
    // escalated to the named owner(s) for explicit sign-off.
    if (action.category === 'irreversible' && action.tier !== 'admin') {
      violations.push({
        rule: 'reversibility-check',
        agent: action.agentId,
        action: action.description,
        detail: `Irreversible action requires sign-off from ${this.ctx.irreversibleRequires.join(', ')}.`,
        severity: 'error',
      });
    }

    // 4. Delegate, don't abdicate — parent retains accountability
    if (action.category === 'delegated') {
      mustWriteDecision = true;
    }

    // 5. Write it down — knowledge-write or decisions
    if (action.requiresRecord || action.category === 'knowledge-write') {
      mustWriteDecision = true;
    }

    // 6. No silent failure — delegated tasks must return verified result
    if (action.category === 'delegated') {
      // The runtime should attach a `verificationPromise` to the task.
      // We only flag a violation if the agent has not done so.
      if (!action.delegateTo) {
        violations.push({
          rule: 'no-silent-failure',
          agent: action.agentId,
          action: action.description,
          detail: 'Delegated task missing explicit sub-agent target.',
          severity: 'warning',
        });
      }
    }

    // 7. Escalate, don't bypass — any error-grade violation forces escalation
    const errors = violations.filter((v) => v.severity === 'error');
    if (errors.length > 0) {
      mustEscalateTo = this.ctx.escalatesTo;
    }

    // 8. Single reporting line — cannot write to another C-suite slice
    // without a delegation grant. We infer this from cross-domain writes.
    if (
      action.category === 'cross-domain' &&
      action.targetDomain &&
      action.tier !== 'admin'
    ) {
      violations.push({
        rule: 'single-reporting-line',
        agent: action.agentId,
        action: action.description,
        detail: `Write to ${action.targetDomain} slice requires delegation grant.`,
        severity: 'error',
      });
    }

    return {
      allowed: errors.length === 0,
      violations,
      mustEscalateTo,
      mustWriteDecision,
    };
  }
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

/**
 * Classify an action so the runtime can route it through guardrails.
 */
export function classifyAction(description: string): ActionCategory {
  const lowered = description.toLowerCase();
  if (/\b(deploy|delete|destroy|spend|allocate)\b/.test(lowered)) {
    return 'irreversible';
  }
  if (/\b(escalat|veto|override)\b/.test(lowered)) {
    return 'escalation';
  }
  if (/\b(delegate|assign|sub-agent|minion)\b/.test(lowered)) {
    return 'delegated';
  }
  if (/\b(record|decision|log|write it down|capture)\b/.test(lowered)) {
    return 'knowledge-write';
  }
  if (/\b(read|fetch|get|search|query)\b/.test(lowered)) {
    return 'reversible';
  }
  if (/\b(update|write|modify|patch|create)\b/.test(lowered)) {
    return 'cross-domain';
  }
  return 'reversible';
}

/**
 * Build a PolicyContext from a RoleProfile and agent id.
 */
export function policyContextFromProfile(
  agentId: string,
  role: CsuiteRole,
  tier: AuthorityTier,
  delegation: DelegationRules,
): PolicyContext {
  return {
    agentId,
    agentRole: role,
    authorityTier: tier,
    mandate: delegation.inMandate,
    requiresRequest: delegation.requiresRequest,
    escalatesTo: delegation.escalatesTo,
    irreversibleRequires: delegation.irreversibleRequires,
  };
}

/* ─────────────────────────────────────────────
 * Sandbox policy enforcement  (next-50 #23)
 *
 * Complements the constitutional guardrails above with a *runtime*
 * sandbox. Before the agent runtime performs a capability — file
 * access, subprocess spawn, network egress, or env reads — it should
 * consult `SandboxPolicy` and abort when `allowed === false` so an
 * agent can never read secrets, touch system files, or exec arbitrary
 * binaries outside its allowlist.
 * ───────────────────────────────────────────── */

export type SandboxCapability = 'fs' | 'exec' | 'network' | 'env';

export interface SandboxProfile {
  /** Absolute roots an agent may touch. Empty = deny all fs access. */
  allowedRoots: string[];
  /** Path prefixes / basenames always denied (secrets, system files). */
  deniedPaths: string[];
  /** Allowlisted base commands. Use `['*']` to allow everything. */
  allowExec: string[];
  /** Allowlisted hosts. Use `['*']` to allow any host. */
  allowNetwork: string[];
  /** Env var names that must never be readable by an agent. */
  deniedEnv: string[];
}

export interface SandboxRequest {
  capability: SandboxCapability;
  path?: string;
  command?: string;
  host?: string;
  port?: number;
  envKey?: string;
}

export interface SandboxVerdict {
  allowed: boolean;
  capability: SandboxCapability;
  reason?: string;
}

/**
 * A safe-by-default profile: nothing is permitted unless explicitly
 * allowed. Denies all fs/exec/network by empty allowlists and blocks
 * the usual secret + system-file locations.
 */
export function defaultSandboxProfile(): SandboxProfile {
  return {
    allowedRoots: [],
    deniedPaths: [
      '/etc',
      '/proc',
      '/sys',
      'C:\\Windows',
      'C:\\Users',
      '/root',
      '/Users',
      '.env',
      '.ssh',
      'credentials',
      'secrets',
    ],
    allowExec: [],
    allowNetwork: [],
    deniedEnv: [
      'API_KEY',
      'SECRET',
      'TOKEN',
      'PASSWORD',
      'PRIVATE_KEY',
      'DATABASE_URL',
    ],
  };
}

export class SandboxPolicy {
  constructor(private readonly profile: SandboxProfile = defaultSandboxProfile()) {}

  /** Route a request to the matching capability check. */
  evaluate(req: SandboxRequest): SandboxVerdict {
    switch (req.capability) {
      case 'fs':
        return this.checkFileAccess(req.path ?? '');
      case 'exec':
        return this.checkExec(req.command ?? '');
      case 'network':
        return this.checkNetwork(req.host ?? '');
      case 'env':
        return this.checkEnv(req.envKey ?? '');
    }
  }

  checkFileAccess(p: string): SandboxVerdict {
    if (!p) {
      return { allowed: false, capability: 'fs', reason: 'empty path' };
    }
    const resolved = path.resolve(p);
    for (const denied of this.profile.deniedPaths) {
      const d = path.resolve(denied);
      if (resolved === d || resolved.startsWith(d + path.sep)) {
        return { allowed: false, capability: 'fs', reason: `denied path: ${denied}` };
      }
      // separator-free entries (e.g. ".env", "credentials", ".ssh") block by
      // case-insensitive substring so "credentials.json" and "keys/.ssh/id_rsa" are caught
      if (!/[\\/]/.test(denied) && resolved.toLowerCase().includes(denied.toLowerCase())) {
        return { allowed: false, capability: 'fs', reason: `denied path component: ${denied}` };
      }
    }
    if (this.profile.allowedRoots.length === 0) {
      return { allowed: false, capability: 'fs', reason: 'no allowed roots configured' };
    }
    const inside = this.profile.allowedRoots.some((root) => {
      const r = path.resolve(root);
      return resolved === r || resolved.startsWith(r + path.sep);
    });
    if (!inside) {
      return {
        allowed: false,
        capability: 'fs',
        reason: `outside allowed roots: ${resolved}`,
      };
    }
    return { allowed: true, capability: 'fs' };
  }

  checkExec(command: string): SandboxVerdict {
    if (!command) {
      return { allowed: false, capability: 'exec', reason: 'empty command' };
    }
    if (this.profile.allowExec.includes('*')) {
      return { allowed: true, capability: 'exec' };
    }
    const base = command.trim().split(/\s+/)[0].replace(/^.*[\\/]/, '');
    if (this.profile.allowExec.includes(base)) {
      return { allowed: true, capability: 'exec' };
    }
    return { allowed: false, capability: 'exec', reason: `command not allowlisted: ${base}` };
  }

  checkNetwork(host: string): SandboxVerdict {
    if (!host) {
      return { allowed: false, capability: 'network', reason: 'empty host' };
    }
    if (this.profile.allowNetwork.includes('*')) {
      return { allowed: true, capability: 'network' };
    }
    if (this.profile.allowNetwork.includes(host)) {
      return { allowed: true, capability: 'network' };
    }
    return { allowed: false, capability: 'network', reason: `host not allowlisted: ${host}` };
  }

  checkEnv(envKey: string): SandboxVerdict {
    if (!envKey) {
      return { allowed: false, capability: 'env', reason: 'empty env key' };
    }
    const upper = envKey.toUpperCase();
    if (this.profile.deniedEnv.some((k) => k.toUpperCase() === upper)) {
      return { allowed: false, capability: 'env', reason: `denied env var: ${envKey}` };
    }
    return { allowed: true, capability: 'env' };
  }
}
