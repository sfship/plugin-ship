import { TaskOutput } from './task.output.js';
import { interpolate } from './flow.interpolate.js';

/**
 * Holds all step outputs for a flow run and owns param interpolation.
 * Internal to the flow runner — not exposed to tasks directly.
 * Tasks interact with outputs only through `TaskOutput` instances.
 */
export class Store {
  private readonly data: Map<string, Map<string, unknown>> = new Map();

  /** Initializes the store, registering a namespace for each step in the flow. */
  public constructor(steps?: Record<string, unknown>) {
    for (const stepId of Object.keys(steps ?? {})) {
      this.data.set(stepId, new Map());
    }
  }

  /** Returns the `TaskOutput` for a step. */
  public getTaskOutput(stepId: string): TaskOutput {
    if (!this.data.has(stepId)) {
      this.data.set(stepId, new Map());
    }
    return new TaskOutput(stepId, this);
  }

  /** Writes a value into a step's namespace. Used by `TaskOutput.set`. */
  public set(stepId: string, key: string, value: unknown): void {
    this.data.get(stepId)?.set(key, value);
  }

  /** Reads a value from a step's namespace. Used by `TaskOutput.get`. */
  public get(stepId: string, key: string): unknown {
    return this.data.get(stepId)?.get(key);
  }

  /** Returns all step outputs as a plain nested object, keyed by step ID. */
  public getSteps(): Record<string, Record<string, unknown>> {
    return Object.fromEntries([...this.data.keys()].map((id) => [id, Object.fromEntries(this.data.get(id)!)]));
  }

  /**
   * Interpolates all `${{ path }}` tokens in a raw params object using the provided context.
   * The caller is responsible for building the context (e.g. `{ params, steps }`).
   */
  // eslint-disable-next-line class-methods-use-this
  public resolveParams(rawParams: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, interpolate(v, context)]));
  }
}
