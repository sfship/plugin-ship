import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type ActionContext, type ActionDefinition, type ShipConfig } from './types.js';

/**
 * Returns the absolute path to the ship directory.
 *
 * @param cwd - Absolute path to the project root (where ship.yml lives).
 * @param config - Parsed ship.yml config.
 */
export function getShipDir(cwd: string, config: ShipConfig): string {
  return resolve(cwd, config.dir ?? '.ship');
}

/**
 * Resolves an org alias using the project naming convention.
 * If the input matches a scratch org definition file in `<shipDir>/orgs/`,
 * returns `<projectName>:<input>`. Otherwise returns the input as-is.
 *
 * @param alias - The raw alias or username to resolve.
 * @param shipDir - Absolute path to the ship directory.
 * @param projectName - Optional project name used as the alias prefix.
 */
export function resolveOrgAlias(alias: string, shipDir: string, projectName?: string): string {
  const defPath = resolve(shipDir, 'orgs', `${alias}.json`);
  if (existsSync(defPath) && projectName) return `${projectName}:${alias}`;
  return alias;
}

/**
 * Loads a custom action from an absolute file path.
 * Supports both default exports and named `run` exports, and plain functions.
 *
 * @param absolutePath - Absolute path to the compiled `.js` action file.
 */
export function loadActionFromPath(absolutePath: string): ActionDefinition {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = require(absolutePath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const exported = (mod?.default ?? mod) as ActionDefinition;
  return typeof exported === 'function' ? { run: exported } : exported;
}

/**
 * Interpolates `${{ params.x }}` and `${{ context.x }}` tokens in a single value.
 * Non-string values are returned unchanged.
 *
 * @param value - The value to interpolate.
 * @param flowParams - Parameters passed to the flow from the CLI.
 * @param getVar - Getter for flow-scoped context variables set by prior steps.
 */
export function interpolate(
  value: unknown,
  flowParams: Record<string, unknown>,
  getVar: (key: string) => unknown
): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
    const [namespace, key] = path.split('.');
    if (namespace === 'params' && key) return String(flowParams[key] ?? match);
    if (namespace === 'context' && key) return String(getVar(key) ?? match);
    return match;
  });
}

/**
 * Interpolates all values in a params object.
 *
 * @param params - Raw params object from the flow step definition.
 * @param flowParams - Parameters passed to the flow from the CLI.
 * @param getVar - Getter for flow-scoped context variables set by prior steps.
 */
export function interpolateParams(
  params: Record<string, unknown>,
  flowParams: Record<string, unknown>,
  getVar: (key: string) => unknown
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, interpolate(v, flowParams, getVar)]));
}

/**
 * Resolves an action by name or path.
 *
 * Resolution order:
 * 1. If `actionName` starts with `./` or `/`, load it as an explicit file path.
 * 2. Look up in the built-in actions registry.
 * 3. Try `<shipDir>/actions/<actionName>.js` as a convention-based fallback.
 *
 * @param actionName - Action name or relative/absolute file path.
 * @param context - The current action context (used to resolve the ship directory).
 * @param builtins - Registry of built-in actions.
 */
export function resolveAction(
  actionName: string,
  context: ActionContext,
  builtins: Record<string, ActionDefinition>
): ActionDefinition {
  const shipDir = getShipDir(context.cwd, context.config);

  if (actionName.startsWith('./') || actionName.startsWith('/')) {
    return loadActionFromPath(resolve(context.cwd, actionName));
  }

  const builtin = builtins[actionName];
  if (builtin) return builtin;

  const conventionPath = resolve(shipDir, 'actions', `${actionName}.js`);
  try {
    return loadActionFromPath(conventionPath);
  } catch {
    throw new Error(`Unknown action: "${actionName}".`);
  }
}
