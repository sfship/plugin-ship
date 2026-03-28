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
  let result = value;
  for (const [match, path] of value.matchAll(/\$\{\{\s*([\w.]+)\s*\}\}/g)) {
    const [namespace, key] = path.split('.');
    const resolved =
      namespace === 'params' && key && flowParams[key] !== undefined
        ? String(flowParams[key])
        : namespace === 'context' && key && getVar(key) !== undefined
        ? String(getVar(key))
        : null;
    if (resolved === null) return null;
    result = result.replace(match, resolved);
  }
  return result;
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
