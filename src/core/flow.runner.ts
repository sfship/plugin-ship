import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition } from '@plugin-ship/core/config.js';
import { validateParams } from '@plugin-ship/core/param.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';
import { Store } from '@plugin-ship/core/store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';
import { asError, ExpectedError } from '@plugin-ship/core/error.utils.js';
import { Task } from '@plugin-ship/core/task.js';

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
    renderer.stepStart(stepId);

    let task: Task | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop
      task = await runner.resolveTask(step.task);
      const interpolated = store.resolveParams(step.params ?? {}, { params: context.params, steps: store.getSteps() });
      const params = validateParams(interpolated, task.params);
      const output = store.getTaskOutput(stepId);

      // eslint-disable-next-line no-await-in-loop
      await task.run({ flow: context, params, output });
    } catch (err) {
      const error = asError(err);
      renderer.stepFailed(stepId, error);

      if (error instanceof ExpectedError && error.message.startsWith('Missing required params')) {
        error.message += `\nRequired params (add to step "${stepId}" in ship.yml)`;
        throw error;
      }

      throw new Error(`Step "${stepId}" in flow "${flowName}" failed: ${error.message}`);
    }

    renderer.stepComplete(stepId);
  }

  renderer.success();
}
