import { asError, ExpectedError } from './util.error.js';

export function wrapRunCommand(
  raw: (id: string, argv: string[]) => Promise<unknown>
): (id: string, argv: string[]) => Promise<unknown> {
  return async (id, argv) => {
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    (process.stdout as { write: unknown }).write = (): boolean => true;
    (process.stderr as { write: unknown }).write = (): boolean => true;
    try {
      return await raw(id, argv);
    } catch (err) {
      throw new ExpectedError(asError(err).message);
    } finally {
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    }
  };
}
