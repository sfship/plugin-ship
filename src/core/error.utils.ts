import { ZodError } from 'zod';

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
 * Formats ZodError, used for validating user-defined objects
 *
 * @param err - ZodError.
 */
export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
}

/**
 * An error thrown when a known, user-facing failure occurs — invalid input,
 * missing config, etc. The flow renderer suppresses the stack trace for these
 * since they indicate a user mistake rather than an unexpected bug.
 */
export class ExpectedError extends Error {}

/**
 * Handles a caught error uniformly.
 * - `ExpectedError`: prints the message and exits with code 1 (no stack trace).
 * - Anything else: rethrows so the caller sees a full stack trace.
 *
 * @param err - The value caught in a `catch` block.
 */
export function handleError(err: unknown, log: (message: string) => void): never {
  const error = asError(err);
  if (error instanceof ExpectedError) {
    log(error.message);
    process.exit(1);
  }
  throw error;
}
