import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowDefinition } from '@plugin-ship/core/config.js';
import { validateParams } from '@plugin-ship/core/param.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';
import { Store } from '@plugin-ship/core/store.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';
import { asError } from '@plugin-ship/core/error.utils.js';

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
  const runner = new TaskRunner(context.shipDir);

  for (const [stepId, step] of steps) {
    renderer.stepStart(stepId);

    try {
      // eslint-disable-next-line no-await-in-loop
      const task = await runner.resolveTask(step.task);
      const interpolated = store.resolveParams(step.params ?? {}, { params: context.params, steps: store.getSteps() });
      const params = validateParams(interpolated, task.params);
      const output = store.getTaskOutput(stepId);

      // eslint-disable-next-line no-await-in-loop
      await task.run({ flow: context, params, output });
    } catch (err) {
      const error = asError(err);
      renderer.stepFailed(stepId, error);
      throw new Error(`Step "${stepId}" in flow "${flowName}" failed: ${error.message}`);
    }

    renderer.stepComplete(stepId);
  }

  renderer.success();
}
