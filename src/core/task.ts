import { ParamDefinition, Params, validate } from '@plugin-ship/core/param.js';
import { FlowContext } from '@plugin-ship/core/flow.js';

/** Describes a value this task writes to the flow store. */
export type OutputDefinition = {
  /** The store key this task writes to. */
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
  /** The parent flow's context, including config, store, org registry, and logger. */
  flow: FlowContext;
  /** The validated params for this task invocation. */
  params: Params;
};

/* eslint-disable jsdoc/check-indentation */
/**
 * Abstract base class for all tasks.
 * Subclasses must declare a `name`, `description`, and `params` schema,
 * and implement `run()` with the task's logic.
 *
 * @example
 * class DeployMetadataTask extends Task {
 *   public readonly name = 'deploy-metadata';
 *   public readonly description = 'Deploys metadata to an org';
 *   public readonly params = [{ name: 'targetOrg', type: 'string', required: true }];
 *
 *   public async run(context: TaskContext) { ... }
 * }
 */
/* eslint-enable jsdoc/check-indentation */
export abstract class Task {
  /** Values this task writes to the flow store, available to subsequent steps. */
  public readonly outputs: OutputDefinition[] = [];

  /** Unique identifier for this task, used in flow definitions and error messages. */
  public abstract readonly name: string;
  /** Human-readable description of what this task does. */
  public abstract readonly description: string;
  /** Schema describing the params this task accepts. */
  public abstract readonly params: ParamDefinition[];

  /**
   * Validates raw param input against this task's param schema.
   * Called by the flow runner before `run()` to ensure all required params
   * are present and correctly typed.
   *
   * @param rawParams - Unvalidated key/value pairs, typically from user input or flow config.
   * @returns Validated and typed `Params` object.
   * @throws If any required param is missing or a value has the wrong type.
   */
  public validate(rawParams: Record<string, unknown>): Params {
    try {
      return validate(rawParams, this.params);
    } catch (err) {
      throw new Error(`Error validating task "${this.name}": ${(err as Error).message}`);
    }
  }

  /** Executes the task with a fully validated context. */
  public abstract run(context: TaskContext): Promise<void>;
}
