import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  Guardrails,
  classifyAction,
  policyContextFromProfile,
  SandboxPolicy,
  defaultSandboxProfile,
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
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.violations.length, 0);
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
    assert.strictEqual(result.allowed, false);
    assert.ok(result.violations.some((v) => v.rule === 'reversibility-check'));
    assert.strictEqual(result.mustEscalateTo, 'CEO');
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
    assert.strictEqual(result.allowed, false);
    assert.ok(result.violations.some((v) => v.rule === 'mandate-boundary'));
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
    assert.strictEqual(result.mustWriteDecision, true);
  });

  it('classifies irreversible verbs correctly', () => {
    assert.strictEqual(classifyAction('deploy to prod'), 'irreversible');
    assert.strictEqual(classifyAction('delete old records'), 'irreversible');
  });

  it('classifies delegation verbs correctly', () => {
    assert.strictEqual(classifyAction('delegate task to minion'), 'delegated');
    assert.strictEqual(classifyAction('assign sub-agent'), 'delegated');
  });

  it('builds a PolicyContext from a profile', () => {
    const ctx = policyContextFromProfile('agent-cfo', 'CFO', 'admin', baseDelegation);
    assert.strictEqual(ctx.agentId, 'agent-cfo');
    assert.strictEqual(ctx.authorityTier, 'admin');
    assert.strictEqual(ctx.escalatesTo, 'CEO');
  });
});

describe('SandboxPolicy (next-50 #23)', () => {
  const workRoot = process.platform === 'win32' ? 'C:\\agent-work' : '/opt/agent-work';

  it('default profile denies fs access when no roots are configured', () => {
    const policy = new SandboxPolicy();
    const verdict = policy.evaluate({ capability: 'fs', path: '/tmp/hello.txt' });
    assert.strictEqual(verdict.allowed, false);
    assert.match(verdict.reason ?? '', /no allowed roots/i);
  });

  it('allows file access inside an allowed root', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowedRoots: [workRoot] });
    const verdict = policy.evaluate({ capability: 'fs', path: `${workRoot}/out/report.json` });
    assert.strictEqual(verdict.allowed, true);
  });

  it('denies file access outside allowed roots', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowedRoots: [workRoot] });
    const verdict = policy.evaluate({ capability: 'fs', path: '/etc/passwd' });
    assert.strictEqual(verdict.allowed, false);
  });

  it('denies system paths even when inside an allowed root branch', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowedRoots: ['/'] });
    const verdict = policy.evaluate({ capability: 'fs', path: '/etc/shadow' });
    assert.strictEqual(verdict.allowed, false);
    assert.match(verdict.reason ?? '', /denied path/);
  });

  it('blocks secrets by basename (.env, credentials, .ssh)', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowedRoots: [workRoot] });
    assert.strictEqual(policy.evaluate({ capability: 'fs', path: `${workRoot}/.env` }).allowed, false);
    assert.strictEqual(policy.evaluate({ capability: 'fs', path: `${workRoot}/credentials.json` }).allowed, false);
    assert.strictEqual(policy.evaluate({ capability: 'fs', path: `${workRoot}/keys/.ssh/id_rsa` }).allowed, false);
  });

  it('allows only allowlisted exec commands', () => {
    const policy = new SandboxPolicy({
      ...defaultSandboxProfile(),
      allowExec: ['ls', 'cat', 'node'],
    });
    assert.strictEqual(policy.evaluate({ capability: 'exec', command: 'ls -la' }).allowed, true);
    assert.strictEqual(policy.evaluate({ capability: 'exec', command: 'node server.ts' }).allowed, true);
    assert.strictEqual(policy.evaluate({ capability: 'exec', command: 'rm -rf /' }).allowed, false);
  });

  it('"*" allowlist permits any exec command', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowExec: ['*'] });
    assert.strictEqual(policy.evaluate({ capability: 'exec', command: 'curl evil.sh' }).allowed, true);
  });

  it('denies empty exec commands', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowExec: ['ls'] });
    assert.strictEqual(policy.evaluate({ capability: 'exec', command: '' }).allowed, false);
  });

  it('allows only allowlisted network hosts', () => {
    const policy = new SandboxPolicy({
      ...defaultSandboxProfile(),
      allowNetwork: ['api.forgeos.dev', '127.0.0.1'],
    });
    assert.strictEqual(policy.evaluate({ capability: 'network', host: 'api.forgeos.dev' }).allowed, true);
    assert.strictEqual(policy.evaluate({ capability: 'network', host: 'evil.example.com' }).allowed, false);
  });

  it('"*" allows any network host', () => {
    const policy = new SandboxPolicy({ ...defaultSandboxProfile(), allowNetwork: ['*'] });
    assert.strictEqual(policy.evaluate({ capability: 'network', host: 'anything.test' }).allowed, true);
  });

  it('blocks reads of denied env vars regardless of case', () => {
    const policy = new SandboxPolicy();
    assert.strictEqual(policy.evaluate({ capability: 'env', envKey: 'DATABASE_URL' }).allowed, false);
    assert.strictEqual(policy.evaluate({ capability: 'env', envKey: 'api_key' }).allowed, false);
    assert.strictEqual(policy.evaluate({ capability: 'env', envKey: 'NODE_ENV' }).allowed, true);
  });
});
