import { z } from 'zod';
import { ExpectedError } from './error.utils.js';

/** Zod schema for a value that can be passed as a task or flow param. */
export const ParamValueSchema = z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.string())]);

/** A scalar value that can be passed as a task or flow param. */
export type ParamValue = z.infer<typeof ParamValueSchema>;

/** A resolved, validated set of params, keyed by param name. */
export type Params = Record<string, ParamValue>;

/** Zod schema for a single param declaration, shared between task and flow definitions. */
export const ParamDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'record']).default('string'),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
});
export type ParamDefinition = z.infer<typeof ParamDefinitionSchema>;

/**
 * Validates and coerces raw key/value input against a param schema.
 * Applies defaults, checks for missing required params, and coerces types —
 * so string values from CLI flags are automatically parsed into the declared type.
 *
 * @param rawParams - Unvalidated input, typically from user CLI flags or flow config.
 * @param paramDefinitions - The schema to validate against.
 * @returns A fully resolved `Params` object containing only declared params.
 * @throws If a required param is missing or a value cannot be coerced to the declared type.
 */
export function validateParams(rawParams: Record<string, unknown>, paramDefinitions: ParamDefinition[]): Params {
  const resolved: Params = {};

  const missing = paramDefinitions.filter((d) => d.required && (rawParams[d.name] ?? d.default) === undefined);
  if (missing.length) {
    const list = missing.map((p) => `  ${p.name}`).join('\n');
    throw new ExpectedError(`Missing required params:\n${list}`);
  }

  for (const definition of paramDefinitions) {
    const val = rawParams[definition.name] ?? definition.default;

    if (val !== undefined) {
      if (!isParamValue(val)) {
        throw new ExpectedError(`Param "${definition.name}" must be a string, number, boolean, or record`);
      }
      resolved[definition.name] = coerce(val, definition);
    }
  }

  return resolved;
}

/**
 * Parses an array of "key=value" CLI flag strings into a params object.
 * Supports dotted notation for record params: "tokens.FOO=bar" becomes { tokens: { FOO: "bar" } }.
 */
export function parseCliParams(flags: string[]): Record<string, string | Record<string, string>> {
  const result: Record<string, string | Record<string, string>> = {};
  for (const flag of flags) {
    const i = flag.indexOf('=');
    if (i === -1) throw new ExpectedError(`Invalid param format "${flag}", expected key=value`);
    const key = flag.slice(0, i);
    const value = flag.slice(i + 1);
    const dot = key.indexOf('.');
    if (dot !== -1) {
      const parent = key.slice(0, dot);
      const child = key.slice(dot + 1);
      const existing = result[parent];
      const record: Record<string, string> = typeof existing === 'object' ? existing : {};
      record[child] = value;
      result[parent] = record;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isParamValue(val: unknown): val is ParamValue {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return true;
  if (val !== null && typeof val === 'object' && !Array.isArray(val))
    return Object.values(val).every((v) => typeof v === 'string');
  return false;
}

/**
 * Coerces a value to the type declared in the param definition.
 * If the value is already the correct type it is returned as-is.
 * String values are parsed when the definition expects a number or boolean.
 *
 * @throws If the string cannot be meaningfully parsed into the expected type.
 */
function coerce(val: ParamValue, definition: ParamDefinition): ParamValue {
  if (definition.type === 'record') {
    if (typeof val !== 'object')
      throw new ExpectedError(
        `Param "${definition.name}" expected a record (use dotted notation: ${
          definition.name
        }.KEY=value), got "${String(val)}"`
      );
    return val;
  }
  if (typeof val === definition.type) return val;

  if (definition.type === 'number') {
    const n = Number(val);
    if (isNaN(n)) throw new ExpectedError(`Param "${definition.name}" expected a number, got "${String(val)}"`);
    return n;
  }

  if (definition.type === 'boolean') {
    if (val === 'true') return true;
    if (val === 'false') return false;
    throw new ExpectedError(`Param "${definition.name}" expected a boolean ("true" or "false"), got "${String(val)}"`);
  }

  // definition.type === 'string', val is number or boolean
  return String(val);
}
