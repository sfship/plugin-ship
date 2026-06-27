/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
