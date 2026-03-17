import { Spinner } from '@salesforce/sf-plugins-core';
import { type ActionContext, type ShipConfig } from './types.js';
import { interpolateParams, resolveAction } from './utils.js';
import actions from './actions/index.js';

/**
 * Executes a named flow from the ship.yml config.
 *
 * Each step is run in sequence with a spinner. If a step throws, the spinner
 * is marked as failed, the step's `onError` handler is called if defined,
 * and the error is re-thrown to halt the flow.
 *
 * @param flowName - The name of the flow to run, as defined in ship.yml.
 * @param config - Parsed ship.yml config.
 * @param context - The action context to pass to each step.
 * @param flowParams - Parameters passed from the CLI via `--param key=value`.
 */
export async function runFlow(
  flowName: string,
  config: ShipConfig,
  context: ActionContext,
  flowParams: Record<string, unknown> = {}
): Promise<void> {
  const flow = config.flows?.[flowName];
  if (!flow) {
    const available = Object.keys(config.flows ?? {});
    throw new Error(
      `Flow "${flowName}" not found in ship.yml.${available.length ? ` Available flows: ${available.join(', ')}` : ''}`
    );
  }

  const spinner = new Spinner(true);
  const ctx: ActionContext = {
    ...context,
    log: (message) => spinner.pause(() => context.log(message)),
    exec: async (command) => {
      spinner.stop();
      try {
        await context.exec(command);
      } finally {
        spinner.start(spinner.status ?? '');
      }
    },
  };

  for (const step of flow.steps) {
    const { action, label, params: rawParams = {} } = step;
    const params = interpolateParams(rawParams, flowParams, (key) => ctx.get(key));
    const definition = resolveAction(action, ctx, actions);
    spinner.start(label ?? action);
    try {
      // eslint-disable-next-line no-await-in-loop
      await definition.run({ ...ctx, params });
      spinner.stop();
    } catch (error) {
      spinner.stop('failed');
      if (definition.onError) {
        // eslint-disable-next-line no-await-in-loop
        await definition.onError({ ...ctx, error, params });
      }
      throw error;
    }
  }
}
