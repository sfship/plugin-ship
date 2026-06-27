/* c8 ignore start */
import { z } from 'zod';

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

/** A single param declaration. */
export type ParamDefinition = z.infer<typeof ParamDefinitionSchema>;
/* c8 ignore stop */
