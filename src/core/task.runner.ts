import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { listDir } from '@plugin-ship/core/file.js';
import { Task } from '@plugin-ship/core/task.js';

const builtinsDir = resolve(fileURLToPath(import.meta.url), '..', 'tasks');

function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Task).description === 'string' &&
    Array.isArray((value as Task).params) &&
    typeof (value as Task).run === 'function'
  );
}

async function loadFromPath(taskPath: string): Promise<Task | null> {
  const url = pathToFileURL(taskPath).href;
  let mod: { default: unknown };
  try {
    mod = (await import(url)) as { default: unknown };
  } catch {
    return null;
  }
  if (!isTask(mod.default)) return null;
  return mod.default;
}

function scanDir(dir: string): Set<string> {
  const names = new Set<string>();
  try {
    for (const file of listDir(dir, { recursive: true })) {
      if (typeof file === 'string' && /\.(mjs|js|ts)$/.test(file) && !file.endsWith('.d.ts')) {
        names.add(file.replace(/\.(mjs|js|ts)$/, '').replaceAll('\\', '/'));
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
 * On construction, scans the consumer tasks directory once and caches the
 * available task names. Resolution checks this cache before attempting a
 * filesystem load, so built-in-only flows pay no per-task filesystem cost.
 *
 * Resolution order:
 * 1. `<shipDir>/tasks/<taskName>.mjs` or `.js` — consumer tasks take priority, allowing built-ins to be overridden.
 * 2. `<builtinsDir>/<taskName>.js` — built-in tasks bundled with the plugin.
 */
export class TaskRunner {
  private readonly consumerNames: Set<string>;

  public constructor(private readonly shipDir: string) {
    this.consumerNames = scanDir(resolve(shipDir, 'tasks'));
  }

  /** Lists all available task names. */
  public list(): string[] {
    const names = new Set([...scanDir(builtinsDir), ...this.consumerNames]);
    return [...names].sort();
  }

  /**
   * Resolves a task by name.
   *
   * @param taskName - The task name from the flow step, e.g. "org/scratch/create".
   * @throws If the task cannot be found in either location.
   */
  public async resolveTask(taskName: string): Promise<Task> {
    const builtinPath = resolve(builtinsDir, `${taskName}.js`);

    const consumerTask = this.consumerNames.has(taskName)
      ? (await loadFromPath(resolve(this.shipDir, 'tasks', `${taskName}.mjs`))) ??
        (await loadFromPath(resolve(this.shipDir, 'tasks', `${taskName}.js`)))
      : null;
    const task = consumerTask ?? (await loadFromPath(builtinPath));

    if (!task) {
      throw new Error(
        `Unknown task "${taskName}". Looked for definition file at: ${resolve(this.shipDir, 'tasks', taskName)}`
      );
    }

    return task;
  }
}
