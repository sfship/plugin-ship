import { type ActionDefinition, type ActionFn } from './types.js';

/**
 * Defines an action, providing TypeScript type inference and IDE hints.
 *
 * Accepts either a plain async function or a full `{ run, onError }` object.
 * Plain functions are wrapped into an `ActionDefinition` automatically.
 *
 * @param fnOrDef - An action function or a full action definition object.
 * @returns A normalised {@link ActionDefinition}.
 */
export function defineAction(fnOrDef: ActionFn | ActionDefinition): ActionDefinition {
  if (typeof fnOrDef === 'function') {
    return { run: fnOrDef };
  }
  return fnOrDef;
}
