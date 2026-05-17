import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition, FlowStep } from '@plugin-ship/core/flow.definition.schema.js';
import { validateParams } from '@plugin-ship/core/task.param.js';
import { TaskRegistry } from '@plugin-ship/core/task.registry.js';
import { Store } from '@plugin-ship/core/flow.store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';
import { asError, ExpectedError } from '@plugin-ship/core/util.error.js';
import { Task } from '@plugin-ship/core/task.js';

type StepCondition = NonNullable<FlowStep['if']>;

function deepGet(root: unknown, keys: string[]): unknown {
  let val: unknown = root;
  for (const key of keys) {
    // c8 ignore next — val === null guards against tasks setting null outputs at intermediate paths
    if (val === null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
}

function resolveConditionValue(condition: StepCondition, context: Record<string, unknown>): unknown {
  const match = condition.value.match(/^\$\{\{\s*([\w.-]+)\s*\}\}$/);
  return match ? deepGet(context, match[1].split('.')) ?? null : condition.value;
}

function evaluateIf(condition: StepCondition, context: Record<string, unknown>): boolean {
  const resolved = resolveConditionValue(condition, context);
  return condition.equals !== undefined ? resolved === condition.equals : Boolean(resolved);
}

function evaluateIfNot(condition: StepCondition, context: Record<string, unknown>): boolean {
  const resolved = resolveConditionValue(condition, context);
  return condition.equals !== undefined ? resolved !== condition.equals : !resolved;
}

type StepError = { stepId: string; error: Error };

async function runSteps(
  stepEntries: Array<[string, FlowStep]>,
  flowName: string,
  context: FlowContext,
  store: Store,
  taskRunner: TaskRegistry,
  renderer: FlowRenderer,
  ignoreAllFailures = false
): Promise<StepError | undefined> {
  for (const [stepId, step] of stepEntries) {
    const interpolationContext = {
      params: context.params,
      steps: store.getSteps(),
      config: context.config,
      flow: { hasFailures: context.hasFailures },
    };

    if (step.if && !evaluateIf(step.if, interpolationContext)) {
      renderer.stepSkipped(stepId);
      continue;
    }
    if (step['if-not'] && !evaluateIfNot(step['if-not'], interpolationContext)) {
      renderer.stepSkipped(stepId);
      continue;
    }

    renderer.stepStart(stepId);

    try {
      // eslint-disable-next-line no-await-in-loop
      const task: Task = await taskRunner.resolveTask(step.task);
      const interpolated = store.resolveParams(step.params ?? {}, interpolationContext);
      const params = validateParams(interpolated, task.params);
      const output = store.getTaskOutput(stepId);
      // eslint-disable-next-line no-await-in-loop
      await task.run({ flow: context, params, output });
    } catch (err) {
      const error = asError(err);

      if (step['ignore-failure'] ?? ignoreAllFailures) {
        renderer.stepIgnored(stepId, error);
        store.set(stepId, 'failed', true);
        store.set(stepId, 'error', error.message);
        // eslint-disable-next-line no-param-reassign
        context.hasFailures = true;
        continue;
      }

      renderer.stepFailed(stepId);
      store.set(stepId, 'failed', true);
      store.set(stepId, 'error', error.message);
      // eslint-disable-next-line no-param-reassign
      context.hasFailures = true;

      error.message =
        error instanceof ExpectedError
          ? `${error.message}\n(step "${stepId}" in flow "${flowName}")`
          : `Step "${stepId}" in flow "${flowName}" failed: ${error.message}`;
      return { stepId, error };
    }

    renderer.stepComplete(stepId);
  }

  return undefined;
}

export async function runFlow(flowName: string, flow: FlowDefinition, context: FlowContext): Promise<void> {
  const mainSteps = Object.entries(flow.steps);
  const finallySteps = Object.entries(flow.finally ?? {});
  const renderer = new FlowRenderer(flowName, mainSteps, finallySteps, context);

  if (flow.params?.length) {
    try {
      // eslint-disable-next-line no-param-reassign
      context.params = validateParams(context.params, flow.params);
    } catch (err) {
      renderer.failedBeforeStart(asError(err));
      throw err;
    }
  }

  // oclif converts Ctrl+C into an EEXIT error on the process. Take over here
  // (the renderer is ours now) so an interrupt prints a clean failure instead
  // of a raw stack, and unexpected crashes still report through the renderer.
  const onUncaught = (err: unknown): void => {
    const e = asError(err);
    if ((e as { code?: unknown }).code === 'EEXIT') {
      const exitCode = (e as { oclif?: { exit?: number } }).oclif?.exit ?? 1;
      if (exitCode === 130) {
        (process.stdout as { write: unknown }).write = (): boolean => true;
        (process.stderr as { write: unknown }).write = (): boolean => true;
        renderer.interrupt();
      }
      process.exit(exitCode);
    }
    renderer.flowFailed(renderer.activeStep ?? '?', e);
    process.exit(1);
  };
  process.once('uncaughtException', onUncaught);

  try {
    renderer.start();

    const store = new Store(flow.steps);
    const taskRunner = new TaskRegistry(context.shipDir);

    const hardError = await runSteps(mainSteps, flowName, context, store, taskRunner, renderer);
    await runSteps(finallySteps, flowName, context, store, taskRunner, renderer, true);

    if (hardError) {
      renderer.flowFailed(hardError.stepId, hardError.error);
      throw new ExpectedError(hardError.error.message);
    }
    renderer.success();
  } finally {
    process.removeListener('uncaughtException', onUncaught);
  }
}
