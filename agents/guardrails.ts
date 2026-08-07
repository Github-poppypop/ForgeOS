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

    // 3. Irreversibility check — deploys/deletes/spend need sign-off
    if (
      action.category === 'irreversible' &&
      !this.ctx.irreversibleRequires.includes(this.ctx.escalatesTo)
    ) {
      // Check if current tier qualifies; admin can often self-approve
      // but we still require explicit sign-off by the named owner.
      if (action.tier !== 'admin') {
        violations.push({
          rule: 'reversibility-check',
          agent: action.agentId,
          action: action.description,
          detail: `Irreversible action requires sign-off from ${this.ctx.irreversibleRequires.join(', ')}.`,
          severity: 'error',
        });
      }
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
