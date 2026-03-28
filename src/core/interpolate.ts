/**
 * Traverses a nested object by an array of keys.
 * Returns `undefined` if any segment is missing or non-traversable.
 */
function deepGet(root: unknown, keys: string[]): unknown {
  let val: unknown = root;
  for (const key of keys) {
    if (val == null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
}

/**
 * Interpolates `${{ params.x }}` and `${{ steps.<id>.<key> }}` tokens in a single value.
 * Supports deep traversal: `${{ steps.create-org.targetOrg }}` or `${{ params.nested.value }}`.
 * Non-string values are returned unchanged.
 *
 * @param value - The value to interpolate.
 * @param flowParams - Parameters passed to the flow from the CLI.
 * @param stepOutputs - Outputs collected from prior steps, keyed by step ID.
 */
export function interpolate(
  value: unknown,
  flowParams: Record<string, unknown>,
  stepOutputs: Record<string, Record<string, unknown>>
): unknown {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [match, path] of value.matchAll(/\$\{\{\s*([\w.-]+)\s*\}\}/g)) {
    const [namespace, ...keys] = path.split('.');
    if (!keys.length) return null;
    const raw =
      namespace === 'params'
        ? deepGet(flowParams, keys)
        : namespace === 'steps'
        ? deepGet(stepOutputs, keys)
        : undefined;
    if (raw == null) return null;
    result = result.replace(match, String(raw));
  }
  return result;
}

/**
 * Interpolates all values in a params object.
 *
 * @param params - Raw params object from the flow step definition.
 * @param flowParams - Parameters passed to the flow from the CLI.
 * @param stepOutputs - Outputs collected from prior steps, keyed by step ID.
 */
export function interpolateParams(
  params: Record<string, unknown>,
  flowParams: Record<string, unknown>,
  stepOutputs: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, interpolate(v, flowParams, stepOutputs)]));
}
