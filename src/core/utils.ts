/**
 * Returns the value if defined, otherwise returns a Proxy that throws a clear
 * error message on any property access. Allows optional dependencies to be
 * typed as non-optional in consuming code.
 */
export function requireValue<T extends object>(value: T | undefined, message: string): T {
  if (value !== undefined) return value;
  return new Proxy({} as T, {
    get(): never {
      throw new Error(message);
    },
  });
}
