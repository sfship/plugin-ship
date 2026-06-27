/*
 * Copyright 2026, Salesforce, Inc.
 *
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
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { listDir } from './file.js';
import { Task, TaskSchema } from './task.definition.schema.js';
import { asError, ExpectedError, formatZodError } from './error.js';
import { normalizePath } from './file.js';

const builtinsDir = resolve(fileURLToPath(import.meta.url), '..', 'tasks');

async function loadFromPath(taskPath: string, name: string): Promise<Task> {
  let mod: { default: unknown };
  try {
    mod = (await import(pathToFileURL(taskPath).href)) as { default: unknown };
  } catch (err) {
    throw new ExpectedError(`Failed to load task at ${taskPath}: ${asError(err).message}`);
  }
  const result = TaskSchema.safeParse(mod.default);
  if (!result.success) throw new ExpectedError(`Invalid task at ${taskPath}: ${formatZodError(result.error)}`);
  return { ...result.data, name } as Task;
}

function scanDir(dir: string): Set<string> {
  const names = new Set<string>();
  try {
    for (const file of listDir(dir, { recursive: true })) {
      if (/\.(mjs|js|ts)$/.test(file) && !file.endsWith('.d.ts')) {
        names.add(file.replaceAll('\\', '/'));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return names;
}

/**
 * Resolves and loads tasks by name.
 *
 * On construction, scans both the built-in and consumer task directories and
 * builds a name → path map. Consumer tasks shadow built-ins of the same name.
 */
export class TaskRegistry {
  private readonly shipDir: string;
  private readonly tasks: Map<string, string>;

  /** @param shipDir - The ship directory for this project. Consumer tasks are loaded from `<shipDir>/tasks`. */
  public constructor(shipDir: string) {
    this.shipDir = shipDir;
    this.tasks = new Map();
    for (const file of scanDir(builtinsDir))
      this.tasks.set(normalizePath(file.replace(/(?:\/index)?\.(mjs|js|ts)$/, '')), resolve(builtinsDir, file));
    for (const file of scanDir(resolve(shipDir, 'tasks')))
      this.tasks.set(normalizePath(file.replace(/(?:\/index)?\.(mjs|js|ts)$/, '')), resolve(shipDir, 'tasks', file));
  }

  /** Lists all available task names. */
  public list(): string[] {
    return [...this.tasks.keys()].sort();
  }

  /**
   * Resolves a task by name.
   *
   * @param taskName - The task name from the flow step, e.g. "org/create/scratch".
   * @throws If the task cannot be found in either location.
   */
  public async resolveTask(taskName: string): Promise<Task> {
    const name = normalizePath(taskName);
    const taskPath = this.tasks.get(name);
    if (!taskPath)
      throw new ExpectedError(`Unknown task "${taskName}". Looked in: ${resolve(this.shipDir, 'tasks', name)}`);
    return loadFromPath(taskPath, name);
  }
}
