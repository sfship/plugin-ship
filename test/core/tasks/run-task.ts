import { createFlowContext, type FlowContext } from '../../../src/core/flow.context.js';
import { OrgRegistry } from '../../../src/core/org.registry.js';
import { Store } from '../../../src/core/flow.store.js';
import type { Task } from '../../../src/core/task.definition.schema.js';
import type { Params } from '../../../src/core/task.param.schema.js';

/** A single in-process `sf` command invocation captured during a task run. */
export type CommandCall = { id: string; argv: string[] };

export type RunTaskOptions = {
  /** Resolved params, as the task receives them after validation. */
  params?: Params;
  /**
   * Stand-in for the in-process `sf` command runner. Gets the command id and
   * argv, returns the result the task should see, or throws to simulate a
   * command failure. Defaults to a no-op returning `undefined`.
   */
  runCommand?: FlowContext['runCommand'];
  /** Overrides for the surrounding environment (projectDir, orgs, config, …). */
  context?: Partial<Omit<FlowContext, 'hasFailures' | 'log' | 'params' | 'runCommand'>>;
};

export type RunTaskResult = {
  /** Lines the task wrote via `flow.log`, in order. */
  logs: string[];
  /** Commands the task invoked via `flow.runCommand`, in order. */
  commands: CommandCall[];
  /** Named values the task wrote via `output.set`. */
  outputs: Record<string, unknown>;
};

function makeTaskContext(overrides: Partial<Omit<FlowContext, 'hasFailures'>>): FlowContext {
  return createFlowContext({
    projectDir: '/proj',
    shipDir: '/proj/.ship',
    config: { project: { slug: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/proj/.ship/orgs'),
    log: () => {},
    params: {},
    runCommand: async () => undefined,
    ...overrides,
  });
}

/**
 * Runs a task's `run()` directly, capturing its log output and the sf commands
 * it invoked. The only seams a task touches — `runCommand` and `log` — are
 * stubbed here; pure helpers (arg building, alias resolution) run for real.
 *
 * Takes the task's exported definition; only `run` is needed (`name`/`outputs`
 * are injected by the loader at runtime, not present on the raw export).
 */
export async function runTask(task: Pick<Task, 'run'>, options: RunTaskOptions = {}): Promise<RunTaskResult> {
  const logs: string[] = [];
  const commands: CommandCall[] = [];
  const params = options.params ?? {};

  // A real store-backed output, so tasks that call `output.set` run for real.
  const stepId = 'step';
  const store = new Store();
  const output = store.getTaskOutput(stepId);

  const flow = makeTaskContext({
    ...options.context,
    params,
    log: (message) => logs.push(message),
    runCommand: async (id, argv) => {
      commands.push({ id, argv });
      return options.runCommand?.(id, argv);
    },
  });

  await task.run({ flow, params, output });

  return { logs, commands, outputs: store.getSteps()[stepId] ?? {} };
}
