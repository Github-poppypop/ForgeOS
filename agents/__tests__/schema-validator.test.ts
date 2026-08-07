import { describe, it, expect } from 'bun:test';
import { schemaValidator, SchemaValidator } from '../schema-validator';

describe('agents/schema-validator', () => {
  it('validates object against named schema', () => {
    schemaValidator.register('package', {
      type: 'object',
      required: ['name', 'version'],
      properties: { name: { type: 'string' }, version: { type: 'string' } },
    });
    const result = schemaValidator.validate('package', { name: 'test', version: '1.0.0' });
    expect(result.valid).toBe(true);
  });

  it('reports missing required fields', () => {
    schemaValidator.register('package-required', {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    });
    const result = schemaValidator.validate('package-required', {});
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Missing required property: name'))).toBe(true);
  });
});
