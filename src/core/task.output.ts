import type { Store } from './flow.store.js';

/**
 * Task-facing output API. Passed into `TaskContext` so tasks can read and write
 * step outputs without holding a reference to the full `Store`.
 *
 * - `get(key)` — reads this step's own output.
 * - `get(stepId, key)` — reads another step's output by its ID.
 * - `set(key, value)` — writes a named output value under this step's namespace.
 */
export class TaskOutput {
  public constructor(private readonly stepId: string, private readonly store: Store) {}

  /**
   * Writes a named output value under this step's namespace,
   * making it available to subsequent steps via `${{ steps.<id>.<key> }}`.
   *
   * @param key - The output key.
   * @param value - The value to store.
   */
  public set(key: string, value: unknown): void {
    this.store.set(this.stepId, key, value);
  }

  /**
   * Reads an output value.
   *
   * @param keyOrStepId - The output key (own step) or step ID (other step).
   * @param key - The output key when reading from another step.
   */
  public get(keyOrStepId: string, key?: string): unknown {
    if (key === undefined) {
      return this.store.get(this.stepId, keyOrStepId);
    }
    return this.store.get(keyOrStepId, key);
  }
}
