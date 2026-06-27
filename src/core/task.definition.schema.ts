/* c8 ignore start */
import { z } from 'zod';
import { ParamDefinitionSchema, Params } from './task.param.schema.js';
import { FlowContext } from './flow.context.js';
import { TaskOutput } from './task.output.js';

/** Zod schema for a value this task writes to the flow outputs. */
export const TaskOutputDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object']),
  description: z.string(),
});

/** Describes a value this task writes to the flow outputs. */
export type TaskOutputDefinition = z.infer<typeof TaskOutputDefinitionSchema>;

/**
 * The runtime context passed to a task's `run()` method.
 * Combines the broader flow context with the task's resolved, validated params.
 */
export type TaskContext = {
  /** The parent flow's context, including config, org registry, and logger. */
  flow: FlowContext;
  /** The validated params for this task invocation. */
  params: Params;
  /** Reads and writes named output values for this step. */
  output: TaskOutput;
};

/**
 * The shape every task must satisfy — built-in or custom.
 * Custom tasks are duck-typed against this at runtime.
 */
export const TaskSchema = z.object({
  description: z.string().default(''),
  params: z.array(ParamDefinitionSchema).default([]),
  outputs: z.array(TaskOutputDefinitionSchema).default([]),
  run: z.function(),
});

/** The input shape a task file must export — fields with defaults are optional. */
export type TaskDefinition = z.input<typeof TaskSchema>;

/**
 * A fully loaded task, with all fields normalized and `name` injected from the file path.
 * This is the type the runner works with internally after loading a {@link TaskDefinition}.
 */
export type Task = Omit<z.infer<typeof TaskSchema>, 'run'> & {
  name: string;
  run: (context: TaskContext) => Promise<void>;
};
/* c8 ignore stop */
