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
import esmock from 'esmock';
import type { Task } from '../../../src/core/task.definition.schema.js';

const load = esmock as (path: string, mocks?: Record<string, unknown>) => Promise<Record<string, unknown>>;

/**
 * Esmocks a task module and returns its default export.
 *
 * - taskPath: relative to src/core/tasks/ (e.g. 'util/file/find.js')
 * - mocks: keys are src/core/ module names (e.g. 'file.js') or bare node: specifiers
 */
export async function mockTask(
  taskPath: string,
  mocks: Record<string, Record<string, unknown>> = {}
): Promise<Pick<Task, 'run'>> {
  const resolvedMocks: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mocks)) {
    resolvedMocks[key.startsWith('node:') ? key : `../../../src/core/${key}`] = value;
  }
  const mod = await load(`../../../src/core/tasks/${taskPath}`, resolvedMocks);
  return mod['default'] as Pick<Task, 'run'>;
}
