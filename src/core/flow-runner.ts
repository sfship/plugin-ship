import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { type ActionContext, type ActionDefinition, type ShipConfig } from './types.js';
import logAction from './actions/log.js';

const builtinActions: Record<string, ActionDefinition> = {
  log: logAction,
};

function loadFromPath(absolutePath: string): ActionDefinition {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = require(absolutePath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const exported = (mod?.default ?? mod) as ActionDefinition;
  return typeof exported === 'function' ? { run: exported } : exported;
}

/**
 * Resolves an action by name or path.
 *
 * Resolution order:
 * 1. If `actionName` starts with `./` or `/`, load it as an explicit file path.
 * 2. Look up in the built-in actions registry.
 * 3. Try `<shipDir>/actions/<actionName>.js` as a convention-based fallback.
 *
 * @param actionName - The built-in action name, a relative/absolute file path, or a custom action name.
 * @param cwd - The working directory used to resolve relative paths.
 * @param shipDir - Absolute path to the ship directory (e.g. `<cwd>/.ship`).
 * @throws {Error} If the action cannot be resolved by any strategy.
 */
function resolveAction(actionName: string, cwd: string, shipDir: string): ActionDefinition {
  if (actionName.startsWith('./') || actionName.startsWith('/')) {
    return loadFromPath(resolve(cwd, actionName));
  }

  const builtin = builtinActions[actionName];
  if (builtin) return builtin;

  const conventionPath = resolve(shipDir, 'actions', `${actionName}.js`);
  try {
    return loadFromPath(conventionPath);
  } catch {
    throw new Error(`Unknown action: "${actionName}".`);
  }
}

/**
 * Executes a named flow from the given config, running each step in order.
 *
 * If a step's action throws, `onError` is called (if defined) before re-throwing.
 *
 * @param flowName - The name of the flow to run, as defined in `ship.yml`.
 * @param config - The parsed ship config containing flow definitions.
 * @param context - The runtime context (e.g. logging) passed to each action.
 * @param cwd - The working directory used to resolve custom action paths. Defaults to `process.cwd()`.
 * @throws {Error} If the flow name is not found in the config.
 */
export async function runFlow(
  flowName: string,
  config: ShipConfig,
  context: ActionContext,
  cwd: string = process.cwd()
): Promise<void> {
  const shipDir = resolve(cwd, config.shipDir ?? '.ship');
  const steps = config.flows?.[flowName];
  if (!steps) {
    const available = Object.keys(config.flows ?? {});
    throw new Error(
      `Flow "${flowName}" not found in ship.yml.${available.length ? ` Available flows: ${available.join(', ')}` : ''}`
    );
  }

  for (const step of steps) {
    const { action, ...params } = step;
    const definition = resolveAction(action, cwd, shipDir);
    try {
      // eslint-disable-next-line no-await-in-loop
      await definition.run({ ...context, params });
    } catch (error) {
      if (definition.onError) {
        // eslint-disable-next-line no-await-in-loop
        await definition.onError({ ...context, error, params });
      }
      throw error;
    }
  }
}
