import { type ActionDefinition, type ActionFn } from './types.js';

/**
 * No-op wrapper that exists purely to provide TypeScript type inference
 * and IDE hints in plain JS files via JSDoc / @ts-check.
 */
export function defineAction(fnOrDef: ActionFn | ActionDefinition): ActionDefinition {
  if (typeof fnOrDef === 'function') {
    return { run: fnOrDef };
  }
  return fnOrDef;
}
