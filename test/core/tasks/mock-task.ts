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
