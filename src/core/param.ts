/** A scalar value that can be passed as a task or flow param. */
export type ParamValue = string | number | boolean;

/** A resolved, validated set of params, keyed by param name. */
export type Params = Record<string, ParamValue>;

/** Declares a single param that a task or flow accepts. */
export type ParamDefinition = {
  /** The param's key name. */
  name: string;
  /** Expected primitive type; used for runtime type-checking. */
  type: 'string' | 'number' | 'boolean';
  /** If `true`, validation will throw when this param is absent and has no default. */
  required?: boolean;
  /** Fallback value used when the param is not provided. */
  default?: unknown;
  /** Human-readable description, used in help output. */
  description?: string;
};

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

  for (const definition of paramDefinitions) {
    const val = rawParams[definition.name] ?? definition.default;

    if (definition.required && val === undefined) {
      throw new Error(`Missing required param "${definition.name}"`);
    }

    if (val !== undefined) {
      if (!isParamValue(val)) {
        throw new Error(`Param "${definition.name}" must be a string, number, or boolean`);
      }
      resolved[definition.name] = coerce(val, definition);
    }
  }

  return resolved;
}

/**
 * Parses an array of "key=value" CLI flag strings into a Params object
 */
export function parseCliParams(flags: string[]): Params {
  const entries = flags.map((flag) => {
    const i = flag.indexOf('=');
    if (i === -1) throw new Error(`Invalid param format "${flag}", expected key=value`);
    const key = flag.slice(0, i);
    const value = flag.slice(i + 1);
    return [key, value] as const;
  });
  return Object.fromEntries(entries);
}

function isParamValue(val: unknown): val is ParamValue {
  return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';
}

/**
 * Coerces a value to the type declared in the param definition.
 * If the value is already the correct type it is returned as-is.
 * String values are parsed when the definition expects a number or boolean.
 *
 * @throws If the string cannot be meaningfully parsed into the expected type.
 */
function coerce(val: ParamValue, definition: ParamDefinition): ParamValue {
  if (typeof val === definition.type) return val;

  if (definition.type === 'number') {
    const n = Number(val);
    if (isNaN(n)) throw new Error(`Param "${definition.name}" expected a number, got "${String(val)}"`);
    return n;
  }

  if (definition.type === 'boolean') {
    if (val === 'true') return true;
    if (val === 'false') return false;
    throw new Error(`Param "${definition.name}" expected a boolean ("true" or "false"), got "${String(val)}"`);
  }

  // definition.type === 'string', val is number or boolean
  return String(val);
}
