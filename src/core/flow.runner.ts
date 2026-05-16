import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition, FlowStep } from '@plugin-ship/core/flow.definition.schema.js';
import { validateParams } from '@plugin-ship/core/task.param.js';
import { TaskRegistry } from '@plugin-ship/core/task.registry.js';
import { Store } from '@plugin-ship/core/flow.store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';
import { FlowState } from '@plugin-ship/core/flow.state.js';
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

type StepHooks = {
  onStart: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  onSkipped: (stepId: string) => void;
  onIgnored: (stepId: string, err: Error) => void;
  onFailed: (stepId: string, err: Error) => void;
};

async function runSteps(
  stepEntries: Array<[string, FlowStep]>,
  flowName: string,
  context: FlowContext,
  store: Store,
  taskRunner: TaskRegistry,
  hooks: StepHooks,
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
      hooks.onSkipped(stepId);
      continue;
    }
    if (step['if-not'] && !evaluateIfNot(step['if-not'], interpolationContext)) {
      hooks.onSkipped(stepId);
      continue;
    }

    hooks.onStart(stepId);

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
        hooks.onIgnored(stepId, error);
        store.set(stepId, 'failed', true);
        store.set(stepId, 'error', error.message);
        // eslint-disable-next-line no-param-reassign
        context.hasFailures = true;
        continue;
      }

      hooks.onFailed(stepId, error);
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

    hooks.onComplete(stepId);
  }

  return undefined;
}

export async function runFlow(
  flowName: string,
  flow: FlowDefinition,
  context: FlowContext,
  state: FlowState,
  renderer: FlowRenderer
): Promise<void> {
  if (flow.params?.length) {
    try {
      // eslint-disable-next-line no-param-reassign
      context.params = validateParams(context.params, flow.params);
    } catch (err) {
      renderer.failedBeforeStart(flowName, asError(err));
      throw err;
    }
  }

  const steps = Object.entries(flow.steps);
  const finallySteps = Object.entries(flow.finally ?? {});
  const store = new Store(flow.steps);
  const taskRunner = new TaskRegistry(context.shipDir);

  const hooks: StepHooks = {
    onStart: (id) => {
      state.stepStart(id);
      renderer.update(state.getFrame());
    },
    onComplete: (id) => {
      state.stepComplete(id);
      renderer.update(state.getFrame());
    },
    onSkipped: (id) => {
      state.stepSkipped(id);
      renderer.update(state.getFrame());
    },
    onIgnored: (id, err) => {
      state.stepIgnored(id, err.message);
      renderer.update(state.getFrame());
    },
    onFailed: (id) => {
      state.stepFailed(id);
      renderer.update(state.getFrame());
    },
  };

  const hardError = await runSteps(steps, flowName, context, store, taskRunner, hooks);
  await runSteps(finallySteps, flowName, context, store, taskRunner, hooks, true);

  if (hardError) {
    renderer.flowFailed(flowName, hardError.stepId, hardError.error);
    throw new ExpectedError(hardError.error.message);
  }
  renderer.success(state.getFrame());
}
