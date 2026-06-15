import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { listDir } from './util.file.js';
import { Task, TaskSchema } from './task.js';
import { asError, ExpectedError, formatZodError } from './util.error.js';
import { normalizeName } from './util.path.js';

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
      this.tasks.set(normalizeName(file.replace(/(?:\/index)?\.(mjs|js|ts)$/, '')), resolve(builtinsDir, file));
    for (const file of scanDir(resolve(shipDir, 'tasks')))
      this.tasks.set(normalizeName(file.replace(/(?:\/index)?\.(mjs|js|ts)$/, '')), resolve(shipDir, 'tasks', file));
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
    const name = normalizeName(taskName);
    const taskPath = this.tasks.get(name);
    if (!taskPath)
      throw new ExpectedError(`Unknown task "${taskName}". Looked in: ${resolve(this.shipDir, 'tasks', name)}`);
    return loadFromPath(taskPath, name);
  }
}
