import { resolve } from 'node:path';
import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition } from '@plugin-ship/core/config.js';
import { Task } from '@plugin-ship/core/task.js';
import tasks from '@plugin-ship/core/tasks/index.js';
import { Store } from '@plugin-ship/core/store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';

/**
 * Dynamically loads a custom task from an absolute file path.
 * Expects an `export default` of a Task subclass.
 *
 * @param absolutePath - Absolute path to the compiled `.js` task file.
 */
async function loadTaskFromPath(absolutePath: string): Promise<Task> {
  const mod = (await import(absolutePath)) as { default: new () => Task };

  if (!mod.default || !(mod.default.prototype instanceof Task)) {
    throw new Error(`${absolutePath} does not export a valid Task subclass as default`);
  }

  return new mod.default();
}

/**
 * Resolves a task by name.
 *
 * Resolution order:
 * 1. Look up in the built-in task registry.
 * 2. Convert slashes to path segments and look in `<shipDir>/actions/`,
 * e.g. "github/repo/info" -> "<shipDir>/actions/github/repo/info.js"
 *
 * @param taskName - The action name from the flow step, e.g. "github/repo/info".
 * @param shipDir - Absolute path to the .ship directory.
 * @param builtins - Registry of built-in tasks.
 */
export async function resolveTask(taskName: string, shipDir: string, builtins: Record<string, Task>): Promise<Task> {
  const builtin = builtins[taskName];
  if (builtin) return builtin;

  const parts = taskName.split('/');
  const taskPath = resolve(shipDir, 'actions', ...parts.slice(0, -1), `${parts[parts.length - 1]}.js`);

  try {
    return await loadTaskFromPath(taskPath);
  } catch {
    throw new Error(`Unknown task "${taskName}". Looked for definition file at: ${taskPath}`);
  }
}

/**
 * Runs a named flow from the given context.
 *
 * @param flowName - The name of the flow to run, as defined in ship.yml.
 * @param flow - The flow definition from the parsed config.
 * @param context - The flow-level context for this run.
 * Renders a live step checklist when stdout is a TTY, plain logs otherwise.
 */
export async function runFlow(flowName: string, flow: FlowDefinition, context: FlowContext): Promise<void> {
  const steps = Object.entries(flow.steps);
  const renderer = new FlowRenderer(flowName, steps, context);
  const store = new Store(flow.steps);

  for (const [stepId, step] of steps) {
    renderer.stepStart(stepId);

    // eslint-disable-next-line no-await-in-loop
    const task = await resolveTask(step.task, context.shipDir, tasks);

    const interpolated = store.resolveParams(step.params ?? {}, { params: context.params, steps: store.getSteps() });
    const params = task.validate(interpolated);
    const output = store.getTaskOutput(stepId);

    try {
      // eslint-disable-next-line no-await-in-loop
      await task.run({ flow: context, params, output });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      renderer.stepFailed(stepId, error);
      throw new Error(`Step "${stepId}" in flow "${flowName}" failed: ${error.message}`);
    }

    renderer.stepComplete(stepId);
  }

  renderer.success();
}
