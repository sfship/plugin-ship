import { Params } from '@plugin-ship/core/param.js';
import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { TaskOutput } from '@plugin-ship/core/task.output.js';
import { ParamDefinition } from '@plugin-ship/core/config.js';

/** Describes a value this task writes to the flow outputs. */
export type TaskOutputDefinition = {
  /** The output key this task writes. */
  name: string;
  /** The type of the stored value. */
  type: 'string' | 'number' | 'boolean' | 'object';
  /** Human-readable description of the output value. */
  description: string;
};

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
export type Task = {
  /** Unique identifier used in flow definitions and error messages. */
  name: string;
  /** Human-readable description of what this task does. */
  description: string;
  /** Schema describing the params this task accepts. */
  params: ParamDefinition[];
  /** Values this task writes to the flow outputs, available to subsequent steps. */
  outputs?: TaskOutputDefinition[];
  /** Executes the task with a fully validated context. */
  run: (context: TaskContext) => Promise<void>;
};
