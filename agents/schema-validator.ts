/**
 * agents/schema-validator.ts — Minimal JSON Schema validator
 *
 * Implements a subset of JSON Schema Draft 7 sufficient to validate
 * structured agent outputs against expected shapes. No external deps.
 */

/* ─────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────── */

export type JSONSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  format?: string;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

/* ─────────────────────────────────────────────
 * Validator
 * ───────────────────────────────────────────── */

export class SchemaValidator {
  private readonly schemas: Map<string, JSONSchema> = new Map();

  register(name: string, schema: JSONSchema): void {
    this.schemas.set(name, schema);
  }

  get(name: string): JSONSchema | undefined {
    return this.schemas.get(name);
  }

  validate(name: string, data: unknown): ValidationResult {
    const schema = this.schemas.get(name);
    if (!schema) {
      return { valid: false, errors: [{ path: '', message: `Unknown schema: ${name}` }] };
    }
    return this.validateSchema(schema, data, '');
  }

  validateSchema(schema: JSONSchema, data: unknown, path: string): ValidationResult {
    const errors: Array<{ path: string; message: string }> = [];

    // Type check
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = this.inferType(data);
      if (!types.includes(actualType)) {
        errors.push({
          path,
          message: `Expected type ${types.join('|')} but got ${actualType}`,
        });
        return { valid: false, errors };
      }
    }

    // Null check shortcut
    if (schema.type && schema.type !== 'null' && data === null) {
      return { valid: false, errors: [{ path, message: `Expected ${schema.type} but got null` }] };
    }

    // Object checks
    if (schema.type === 'object' || (schema.properties && !schema.type)) {
      if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as Record<string, unknown>;

        // Required
        if (schema.required) {
          for (const key of schema.required) {
            if (!(key in obj)) {
              errors.push({ path: `${path}/${key}`, message: `Missing required property: ${key}` });
            }
          }
        }

        // Properties
        if (schema.properties) {
          for (const [key, subSchema] of Object.entries(schema.properties)) {
            if (key in obj) {
              const childPath = path ? `${path}/${key}` : key;
              const childResult = this.validateSchema(subSchema, obj[key], childPath);
              errors.push(...childResult.errors);
            }
          }
        }

        // Additional properties
        if (schema.additionalProperties === false) {
          const allowed = new Set(schema.properties ? Object.keys(schema.properties) : []);
          for (const key of Object.keys(obj)) {
            if (!allowed.has(key)) {
              errors.push({ path: `${path}/${key}`, message: `Additional property not allowed: ${key}` });
            }
          }
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          const addSchema = schema.additionalProperties as JSONSchema;
          for (const [key, value] of Object.entries(obj)) {
            if (!schema.properties || !(key in schema.properties)) {
              const childResult = this.validateSchema(addSchema, value, `${path}/${key}`);
              errors.push(...childResult.errors);
            }
          }
        }
      } else {
        errors.push({ path, message: 'Expected object' });
      }
    }

    // Array checks
    if (schema.type === 'array') {
      if (Array.isArray(data)) {
        if (schema.minItems !== undefined && data.length < schema.minItems) {
          errors.push({ path, message: `Array has ${data.length} items, minimum is ${schema.minItems}` });
        }
        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
          errors.push({ path, message: `Array has ${data.length} items, maximum is ${schema.maxItems}` });
        }
        if (schema.items) {
          data.forEach((item, idx) => {
            const childResult = this.validateSchema(schema.items!, item, `${path}[${idx}]`);
            errors.push(...childResult.errors);
          });
        }
      } else {
        errors.push({ path, message: 'Expected array' });
      }
    }

    // String checks
    if (schema.type === 'string') {
      if (typeof data === 'string') {
        if (schema.minLength !== undefined && data.length < schema.minLength) {
          errors.push({ path, message: `String length ${data.length} < minLength ${schema.minLength}` });
        }
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
          errors.push({ path, message: `String length ${data.length} > maxLength ${schema.maxLength}` });
        }
        if (schema.format === 'uri' && !this.isUri(data)) {
          errors.push({ path, message: 'Invalid URI format' });
        }
      } else {
        errors.push({ path, message: 'Expected string' });
      }
    }

    // Number / integer checks
    if (schema.type === 'number' || schema.type === 'integer') {
      if (typeof data === 'number') {
        if (schema.minimum !== undefined && data < schema.minimum) {
          errors.push({ path, message: `Number ${data} < minimum ${schema.minimum}` });
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
          errors.push({ path, message: `Number ${data} > maximum ${schema.maximum}` });
        }
        if (schema.type === 'integer' && !Number.isInteger(data)) {
          errors.push({ path, message: 'Expected integer' });
        }
      } else if (schema.type !== 'null') {
        errors.push({ path, message: 'Expected number' });
      }
    }

    // Enum
    if (schema.enum) {
      if (!schema.enum.includes(data)) {
        errors.push({ path, message: `Value not in enum: ${JSON.stringify(data)}` });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private inferType(value: unknown): JSONSchemaType {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (typeof value === 'string') return 'string';
    return 'object';
  }

  private isUri(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
    }
  }
}

// Singleton
export const schemaValidator = new SchemaValidator();

// Pre-register common agent output schemas
schemaValidator.register('agent-result', {
  type: 'object',
  required: ['agentId', 'status', 'output'],
  properties: {
    agentId: { type: 'string' },
    status: { enum: ['ok', 'degraded', 'failed'] },
    output: { type: ['string', 'object', 'array'] },
    tokensUsed: { type: 'integer', minimum: 0 },
    durationMs: { type: 'number', minimum: 0 },
    errors: { type: 'array' },
    metadata: { type: 'object' },
  },
  additionalProperties: true,
});

schemaValidator.register('dispatch-result', {
  type: 'object',
  required: ['queued', 'missionId', 'agent'],
  properties: {
    queued: { type: 'boolean' },
    missionId: { type: 'string' },
    agent: { type: 'string' },
    decisionSlug: { type: 'string' },
    canary: { type: 'boolean' },
    runbook: { type: 'string' },
  },
  additionalProperties: true,
});
