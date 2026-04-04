/**
 * Coerces an unknown caught value into an `Error`.
 * Returns the original instance if it is already an `Error`; otherwise wraps it with `String()`.
 *
 * @param err - The value caught in a `catch` block.
 */
export function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * An error thrown when a known, user-facing failure occurs — invalid input,
 * missing config, etc. The flow renderer suppresses the stack trace for these
 * since they indicate a user mistake rather than an unexpected bug.
 */
export class ExpectedError extends Error {}
