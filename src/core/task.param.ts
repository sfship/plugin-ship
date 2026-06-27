/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ExpectedError } from './error.js';
import type { ParamValue, ParamDefinition, Params } from './task.param.schema.js';

export type { ParamValue, ParamDefinition, Params };

/**
 * Validates and coerces raw key/value input against a param schema.
 * Applies defaults, checks for missing required params, and coerces types —
 * so string values from CLI flags are automatically parsed into the declared type.
 *
 * @param rawParams - Unvalidated input, typically from user CLI flags or flow config.
 * @param paramDefinitions - The schema to validate against.
 * @returns A fully resolved `Params` object containing only declared params.
 * @throws If a required param is missing or a value cannot be coerced to the declared type.
 */
export function validateParams(rawParams: Record<string, unknown>, paramDefinitions: ParamDefinition[]): Params {
  const resolved: Params = {};

  const missing = paramDefinitions.filter((d) => d.required && (rawParams[d.name] ?? d.default) === undefined);
  if (missing.length) {
    const list = missing.map((p) => `  ${p.name}`).join('\n');
    throw new ExpectedError(`Missing required params:\n${list}`);
  }

  for (const definition of paramDefinitions) {
    const val = rawParams[definition.name] ?? definition.default;

    if (val !== undefined) {
      if (!isParamValue(val)) {
        throw new ExpectedError(`Param "${definition.name}" must be a string, number, boolean, or record`);
      }
      resolved[definition.name] = coerce(val, definition);
    }
  }

  return resolved;
}

/**
 * Parses an array of "key=value" CLI flag strings into a params object.
 * Supports dotted notation for record params: "tokens.FOO=bar" becomes { tokens: { FOO: "bar" } }.
 */
export function parseCliParams(flags: string[]): Record<string, string | Record<string, string>> {
  const result: Record<string, string | Record<string, string>> = {};
  for (const flag of flags) {
    const i = flag.indexOf('=');
    const key = i === -1 ? flag : flag.slice(0, i);
    const value = i === -1 ? 'true' : flag.slice(i + 1);
    const dot = key.indexOf('.');
    if (dot !== -1) {
      const parent = key.slice(0, dot);
      const child = key.slice(dot + 1);
      const existing = result[parent];
      const record: Record<string, string> = typeof existing === 'object' ? existing : {};
      record[child] = value;
      result[parent] = record;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Builds an argv array for a passthrough sf CLI command from a resolved params object.
 *
 * Each param becomes `--key value` (string/number) or `--key` (boolean true).
 * Keys present in `overrides` are skipped from the params scan and replaced with
 * the provided value instead — pass `null` to omit a key entirely.
 *
 * @param params - The resolved params from the task context.
 * @param overrides - Per-key replacements or nulls to skip.
 * @returns A flat argv array ready to pass to `runCommand`.
 */
export function resolvePassthroughArgs(params: Params, overrides: Record<string, string | null> = {}): string[] {
  const merged: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'object') merged[key] = value;
  }
  for (const [flag, value] of Object.entries(overrides)) {
    const key = flag.startsWith('--') ? flag.slice(2) : flag;
    merged[key] = value;
  }

  const argv: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (value === null) continue;
    if (typeof value === 'boolean') {
      if (value) argv.push(`--${key}`);
    } else {
      argv.push(`--${key}`, String(value));
    }
  }
  return argv;
}

function isParamValue(val: unknown): val is ParamValue {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return true;
  if (val !== null && typeof val === 'object' && !Array.isArray(val))
    return Object.values(val).every((v) => typeof v === 'string');
  return false;
}

/**
 * Coerces a value to the type declared in the param definition.
 * If the value is already the correct type it is returned as-is.
 * String values are parsed when the definition expects a number or boolean.
 *
 * @throws If the string cannot be meaningfully parsed into the expected type.
 */
function coerce(val: ParamValue, definition: ParamDefinition): ParamValue {
  if (definition.type === 'record') {
    if (typeof val !== 'object')
      throw new ExpectedError(
        `Param "${definition.name}" expected a record (use dotted notation: ${
          definition.name
        }.KEY=value), got "${String(val)}"`
      );
    return val;
  }
  if (typeof val === definition.type) return val;

  if (definition.type === 'number') {
    const n = Number(val);
    if (isNaN(n)) throw new ExpectedError(`Param "${definition.name}" expected a number, got "${String(val)}"`);
    return n;
  }

  if (definition.type === 'boolean') {
    if (val === 'true') return true;
    if (val === 'false') return false;
    throw new ExpectedError(`Param "${definition.name}" expected a boolean ("true" or "false"), got "${String(val)}"`);
  }

  // definition.type === 'string', val is number or boolean
  return String(val);
}
