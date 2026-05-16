import { asError, ExpectedError } from './util.error.js';

const ESC = String.fromCharCode(0x1b);

export function wrapRunCommand(
  raw: (id: string, argv: string[]) => Promise<unknown>,
  log: (message: string) => void,
  liveUpdate?: (lines: string[]) => void
): (id: string, argv: string[]) => Promise<unknown> {
  return async (id, argv) => {
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);

    // Overwrite-model buffer: cursor-up moves the write position rather than deleting lines,
    // so `display` always holds the current visible state of the sf CLI display.
    const display: string[] = [];
    let writePos = 0;
    let lineBuffer = '';
    let escapeBuffer = '';
    let inEscape = false;

    const redirect = (chunk: unknown): boolean => {
      const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : '';
      for (const char of text) {
        if (inEscape) {
          escapeBuffer += char;
          if (/[a-zA-Z]/.test(char)) {
            if (char === 'A' && escapeBuffer.startsWith('[')) {
              const n = parseInt(escapeBuffer.slice(1, -1) || '1', 10);
              writePos = Math.max(0, writePos - n);
            }
            escapeBuffer = '';
            inEscape = false;
          }
          continue;
        }
        if (char === ESC) {
          inEscape = true;
          continue;
        }
        if (char === '\r') {
          lineBuffer = '';
          continue;
        }
        if (char === '\n') {
          const line = lineBuffer.trim();
          lineBuffer = '';
          if (line) {
            if (writePos < display.length) {
              display[writePos] = line;
            } else {
              display.push(line);
            }
            writePos++;
          }
          continue;
        }
        lineBuffer += char;
      }
      liveUpdate?.([...display]);
      return true;
    };

    (process.stdout as { write: unknown }).write = redirect;
    (process.stderr as { write: unknown }).write = redirect;

    try {
      return await raw(id, argv);
    } catch (err) {
      throw new ExpectedError(asError(err).message);
    } finally {
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
      if (lineBuffer.trim()) {
        const line = lineBuffer.trim();
        if (writePos < display.length) display[writePos] = line;
        else display.push(line);
        writePos++;
      }
      // Clear the live frame, then commit the final lines via log so they
      // appear with timestamps above the checklist.
      liveUpdate?.([]);
      for (const line of display.slice(0, writePos)) log(line);
    }
  };
}
