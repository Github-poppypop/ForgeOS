import {
  Guardrails,
  classifyAction,
  policyContextFromProfile,
} from '../guardrails';
import {
  AuthorityTier,
  CsuiteRole,
  DelegationRules,
  PolicyContext,
  ProposedAction,
} from '../../packages/shared/src/types';

describe('Guardrails engine', () => {
  const baseDelegation: DelegationRules = {
    inMandate: ['infrastructure', 'runtime'],
    requiresRequest: ['CPO', 'CFO'],
    escalatesTo: 'CEO',
    irreversibleRequires: ['CEO', 'COO'],
  };

  function makeCtx(overrides: Partial<PolicyContext> = {}): PolicyContext {
    return {
      agentId: 'agent-cto',
      agentRole: 'CTO',
      authorityTier: 'write',
      mandate: baseDelegation.inMandate,
      requiresRequest: baseDelegation.requiresRequest,
      escalatesTo: 'CEO',
      irreversibleRequires: baseDelegation.irreversibleRequires,
      ...overrides,
    };
  }

  function action(overrides: Partial<ProposedAction> = {}): ProposedAction {
    return {
      id: 'act-001',
      agentId: 'agent-cto',
      role: 'CTO',
      tier: 'write',
      description: 'update service config',
      category: 'reversible',
      ...overrides,
    };
  }

  it('allows reversible actions for write-tier agents', () => {
    const g = new Guardrails(makeCtx());
    const result = g.evaluate(action({ description: 'read service config' }));
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('blocks irreversible actions without admin tier', () => {
    const g = new Guardrails(makeCtx());
    const result = g.evaluate(
      action({
        description: 'deploy production service',
        category: 'irreversible',
        tier: 'write',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.rule === 'reversibility-check')).toBe(true);
    expect(result.mustEscalateTo).toBe('CEO');
  });

  it('flags cross-domain writes requiring formal request', () => {
    const g = new Guardrails(makeCtx());
    const result = g.evaluate(
      action({
        description: 'update marketing campaign',
        category: 'cross-domain',
        targetDomain: 'CMO',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.rule === 'mandate-boundary')).toBe(true);
  });

  it('marks delegated actions as needing a decision record', () => {
    const g = new Guardrails(makeCtx());
    const result = g.evaluate(
      action({
        description: 'delegate infra audit to sub-agent',
        category: 'delegated',
        delegateTo: 'sub-infra-1',
      }),
    );
    expect(result.mustWriteDecision).toBe(true);
  });

  it('classifies irreversible verbs correctly', () => {
    expect(classifyAction('deploy to prod')).toBe('irreversible');
    expect(classifyAction('delete old records')).toBe('irreversible');
  });

  it('classifies delegation verbs correctly', () => {
    expect(classifyAction('delegate task to minion')).toBe('delegated');
    expect(classifyAction('assign sub-agent')).toBe('delegated');
  });

  it('builds a PolicyContext from a profile', () => {
    const ctx = policyContextFromProfile('agent-cfo', 'CFO', 'admin', baseDelegation);
    expect(ctx.agentId).toBe('agent-cfo');
    expect(ctx.authorityTier).toBe('admin');
    expect(ctx.escalatesTo).toBe('CEO');
  });
});
