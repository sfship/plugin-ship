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
