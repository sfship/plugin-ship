/* c8 ignore start */
import { z } from 'zod';
import { ParamDefinitionSchema, ParamValueSchema } from './param.js';

/** A scalar value or null that a condition can compare against. */
const FlowStepConditionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** Condition used in `if` / `if-not` step fields. Resolves a `${{ }}` token and optionally compares it to a value. */
const FlowStepConditionSchema = z
  .object({ value: z.string(), equals: FlowStepConditionValueSchema.optional() })
  .strict();

/** A single step within a flow definition. */
const FlowStepSchema = z
  .object({
    /** The task to execute, e.g. "util/log" or "org/scratch/create". */
    task: z.string(),
    /** Parameters passed to the task. */
    params: z.record(z.string(), ParamValueSchema).optional(),
    /** Run step if condition is truthy (or equals a value). */
    if: FlowStepConditionSchema.optional(),
    /** Run step if condition is falsy (or equals a value). */
    'if-not': FlowStepConditionSchema.optional(),
    /** Continue the flow if this step fails, storing failure state in step outputs. */
    'ignore-failure': z.boolean().optional(),
  })
  .refine((s) => !(s.if && s['if-not']), { message: 'A step cannot have both "if" and "if-not"' });

/** Defines a named flow: its accepted params and the ordered steps to execute. */
export const FlowDefinitionSchema = z
  .object({
    /** Human-readable description of what this flow does. */
    description: z.string().optional(),
    /** Params this flow accepts, passed as `--param key=value` CLI flags when invoking the flow. */
    params: z.array(ParamDefinitionSchema).optional(),
    /** Named steps to execute in definition order. The key is the step ID, used for output references. */
    steps: z.record(z.string(), FlowStepSchema),
    /** Steps that always run after `steps`, regardless of success or failure. */
    finally: z.record(z.string(), FlowStepSchema).optional(),
  })
  .superRefine((flow, ctx) => {
    const dup = Object.keys(flow.finally ?? {}).find((k) => k in flow.steps);
    if (dup) {
      ctx.addIssue({ code: 'custom', message: `Step ID "${dup}" appears in both "steps" and "finally"` });
    }
  });

export type FlowStep = z.infer<typeof FlowStepSchema>;
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
/* c8 ignore stop */
