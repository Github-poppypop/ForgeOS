import { describe, it, expect } from 'bun:test';
import { schemaValidator } from '../agents/schema-validator';

describe('agents/schema-validator', () => {
  it('validates object against schema', () => {
    const result = schemaValidator.validate({ name: 'test', version: '1.0.0' }, {
      type: 'object',
      required: ['name', 'version'],
      properties: { name: { type: 'string' }, version: { type: 'string' } },
    });
    expect(result.valid).toBe(true);
  });
});
