import {
  AuthorityTier,
  CsuiteRole,
  DelegationRules,
  DecisionRight,
  DecisionRecord,
  IncidentRecord,
  KPI,
  LinkType,
  PolicyContext,
  RoleProfile,
} from '../types';

describe('shared types', () => {
  it('exports AuthorityTier literal types', () => {
    const tier: AuthorityTier = 'write';
    expect(['read', 'write', 'admin']).toContain(tier);
  });

  it('exports CsuiteRole literal types', () => {
    const role: CsuiteRole = 'CTO';
    expect(['Board', 'CEO', 'CTO', 'CPO', 'COO', 'CMO', 'CFO']).toContain(role);
  });

  it('builds a DecisionRecord with required fields', () => {
    const decision: DecisionRecord = {
      id: 'dec-001',
      type: 'decision',
      title: 'Adopt gbrain as substrate',
      owner: 'CTO',
      authority: 'admin',
      rationale: 'Avoid re-building memory/ledger.',
      status: 'approved',
      tags: ['role:cto', 'infrastructure'],
      createdAt: new Date().toISOString(),
    };
    expect(decision.type).toBe('decision');
    expect(decision.status).toBe('approved');
  });

  it('builds an IncidentRecord with required fields', () => {
    const incident: IncidentRecord = {
      id: 'inc-001',
      type: 'incident',
      title: 'Scope violation by sub-agent',
      reportedBy: 'COO',
      escalatedTo: 'CTO',
      severity: 'high',
      description: 'Agent wrote to another slice.',
      tags: ['scope', 'enforcement'],
      createdAt: new Date().toISOString(),
    };
    expect(incident.severity).toBe('high');
    expect(incident.escalatedTo).toBe('CTO');
  });

  it('builds a RoleProfile with delegation rules', () => {
    const role: RoleProfile = {
      id: 'agent-cto',
      role: 'CTO',
      reportsTo: 'CEO',
      ownerDomain: 'Technology / Platform / Infrastructure',
      authorityTier: 'write',
      version: '1.0.0',
      description: 'Owns tech and agent runtime.',
      responsibilities: ['Architecture', 'Uptime'],
      decisionRights: {},
      delegation: {
        inMandate: ['architecture', 'infra'],
        requiresRequest: ['CPO', 'COO'],
        escalatesTo: 'CEO',
        irreversibleRequires: ['CEO', 'COO'],
      },
      escalation: { upTo: 'CEO', cadence: 'weekly' },
      kpis: [],
    };
    expect(role.delegation.inMandate).toContain('infra');
    expect(role.delegation.irreversibleRequires).toContain('CEO');
  });

  it('maps LinkType union', () => {
    const link: LinkType = 'reports_to';
    expect(['reports_to', 'owns', 'escalated_to', 'derived_from', 'parent_of', 'publishes', 'reports_up_to']).toContain(link);
  });
});
