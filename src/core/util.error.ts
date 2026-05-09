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

type RawIssue = { code: string; path: Array<string | number>; message: string; errors?: RawIssue[][] };

function formatIssue(issue: RawIssue, pathPrefix: Array<string | number> = []): string {
  const fullPath = [...pathPrefix, ...issue.path].join('.');
  const label = fullPath || '(root)';

  if (issue.code === 'invalid_union' && issue.errors?.length) {
    const variants = issue.errors
      .map((variantIssues) => {
        const first = variantIssues[0];
        // c8 ignore next — Zod always provides at least one issue per union variant
        if (!first) return null;
        const variantPath = [...pathPrefix, ...issue.path, ...first.path].join('.');
        return `      ${variantPath || '(root)'}: ${first.message}`;
      })
      .filter(Boolean)
      .join('\n');
    return `  - ${label}: Invalid input — expected one of:\n${variants}`;
  }

  return `  - ${label}: ${issue.message}`;
}

/**
 * Formats a ZodError into a human-readable string for display in CLI output.
 *
 * @param err - The ZodError to format.
 */
export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => formatIssue(i as RawIssue)).join('\n');
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
