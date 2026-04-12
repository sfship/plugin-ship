import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition } from '@plugin-ship/core/config.js';
import { validateParams } from '@plugin-ship/core/param.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';
import { Store } from '@plugin-ship/core/store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';
import { asError, ExpectedError } from '@plugin-ship/core/error.utils.js';
import { Task } from '@plugin-ship/core/task.js';
import { FlowStep } from '@plugin-ship/core/config.js';

type StepCondition = NonNullable<FlowStep['if']>;

function deepGet(root: unknown, keys: string[]): unknown {
  let val: unknown = root;
  for (const key of keys) {
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
  renderer.start();

  if (flow.params?.length) {
    try {
      // eslint-disable-next-line no-param-reassign
      context.params = validateParams(context.params, flow.params);
    } catch (err) {
      renderer.failedBeforeStart(asError(err));
      throw err;
    }
  }

  const store = new Store(flow.steps);
  const runner = new TaskRunner(context.shipDir);

  for (const [stepId, step] of steps) {
    const interpolationContext = { params: context.params, steps: store.getSteps(), config: context.config };
    if (step.if && !evaluateIf(step.if, interpolationContext)) {
      renderer.stepSkipped(stepId);
      continue;
    }
    if (step['if-not'] && !evaluateIfNot(step['if-not'], interpolationContext)) {
      renderer.stepSkipped(stepId);
      continue;
    }

    renderer.stepStart(stepId);

    let task: Task | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop
      task = await runner.resolveTask(step.task);
      const interpolated = store.resolveParams(step.params ?? {}, interpolationContext);
      const params = validateParams(interpolated, task.params);
      const output = store.getTaskOutput(stepId);

      // eslint-disable-next-line no-await-in-loop
      await task.run({ flow: context, params, output });
    } catch (err) {
      const error = asError(err);
      renderer.stepFailed(stepId, error);

      if (error instanceof ExpectedError) {
        error.message += `\n(step "${stepId}" in flow "${flowName}")`;
        throw error;
      }

      throw new Error(`Step "${stepId}" in flow "${flowName}" failed: ${error.message}`);
    }

    renderer.stepComplete(stepId);
  }

  renderer.success();
}
