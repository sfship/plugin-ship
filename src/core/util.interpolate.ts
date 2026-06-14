/**
 * `${{ path }}` token interpolation, shared by the flow store (param resolution)
 * and the flow runner (`if` / `if-not` condition evaluation)
 */

/** Matches a value that is exactly one `${{ path }}` token, capturing the path. */
const PURE_TOKEN = /^\$\{\{\s*([\w.-]+)\s*\}\}$/;
/** Matches each `${{ path }}` token embedded within a larger string. */
const EMBEDDED_TOKEN = /\$\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Traverses a nested object by an array of keys.
 * Returns `undefined` if any segment is missing or non-traversable.
 */
export function deepGet(root: unknown, keys: string[]): unknown {
  let val: unknown = root;
  for (const key of keys) {
    if (val == null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
}

/**
 * If `value` is exactly one `${{ path }}` token, resolves the path against
 * `context` — yielding `null` when the path is absent so callers can tell
 * "missing" apart from "empty". Returns `undefined` when `value` is not a single
 * pure token, signalling the caller to treat it as a literal or interpolate
 * embedded tokens itself.
 */
export function resolvePureToken(value: string, context: Record<string, unknown>): unknown {
  const match = value.match(PURE_TOKEN);
  return match ? deepGet(context, match[1].split('.')) ?? null : undefined;
}

/**
 * Interpolates `${{ some.path }}` tokens in a value by looking up paths in a
 * unified context object. Non-string values are returned unchanged; plain
 * objects are interpolated recursively. A pure token resolves to the looked-up
 * value (or `null`); a token embedded in surrounding text is stringified, with
 * misses replaced by an empty string.
 */
export function interpolate(value: unknown, context: Record<string, unknown>): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, context)])
    );
  }
  if (typeof value !== 'string') return value;

  const resolved = resolvePureToken(value, context);
  if (resolved !== undefined) return resolved;

  let result = value;
  for (const [match, path] of value.matchAll(EMBEDDED_TOKEN)) {
    const raw = deepGet(context, path.split('.'));
    result = result.replace(match, raw != null ? String(raw) : '');
  }
  return result;
}
