import { FlowStep } from '@plugin-ship/core/flow.definition.schema.js';
import { asError, ExpectedError } from '@plugin-ship/core/util.error.js';
import { FlowFrame } from '@plugin-ship/core/flow.state.js';

const ESC = String.fromCharCode(0x1b);

const DANGEROUS_SEQUENCES = new RegExp(
  `${ESC}\\[\\d*J|${ESC}\\[(\\d+;\\d+)?r|${ESC}\\[[\\d;]*[Hf]|${ESC}\\[\\d*d|${ESC}\\[\\?1049[hl]`,
  'g'
);

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

type OutputStream = {
  isTTY: boolean | undefined;
  write(chunk: string): boolean;
};

export class FlowRenderer {
  public readonly isTTY: boolean | undefined;
  private readonly write: (chunk: string) => boolean;
  private scrollRegionActive = false;
  private dockHeight = 0;
  private lastFrame: FlowFrame | null = null;
  private cleanupHandler: (() => void) | null = null;

  public constructor(out: OutputStream = process.stdout) {
    this.write = out.write.bind(out);
    this.isTTY = out.isTTY;
  }

  private static timestamp(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private static renderStepLine(
    stepId: string,
    step: FlowStep,
    frame: FlowFrame,
    writeLine: (s: string) => void
  ): void {
    let marker: string;
    let color: string;
    if (frame.failed.has(stepId)) {
      marker = '✗';
      color = ANSI.red;
    } else if (frame.ignored.has(stepId)) {
      marker = '⚠';
      color = ANSI.yellow;
    } else if (frame.completed.has(stepId)) {
      marker = '✓';
      color = ANSI.green;
    } else if (frame.skipped.has(stepId)) {
      marker = '—';
      color = ANSI.dim;
    } else if (stepId === frame.current) {
      marker = '→';
      color = ANSI.cyan;
    } else {
      marker = '○';
      color = ANSI.dim;
    }
    const label = stepId.padEnd(20);
    const detail = frame.skipped.has(stepId) ? 'skipped' : step.task;
    writeLine(`  ${color}${marker}${ANSI.reset} ${label} ${ANSI.dim}(${detail})${ANSI.reset}`);
  }

  private static computeDockHeight(frame: FlowFrame): number {
    return 4 + frame.mainSteps.length + (frame.finallySteps.length > 0 ? 2 + frame.finallySteps.length : 0);
  }

  /** Wraps a runCommand function, stripping ANSI sequences that would corrupt the scroll region. */
  public wrapCommand(
    raw: (id: string, argv: string[]) => Promise<unknown>
  ): (id: string, argv: string[]) => Promise<unknown> {
    return async (id, argv) => {
      const stdoutWrite = process.stdout.write.bind(process.stdout);
      const stderrWrite = process.stderr.write.bind(process.stderr);
      const filtered = (chunk: unknown): boolean => {
        const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
        return this.write(text.replace(DANGEROUS_SEQUENCES, ''));
      };
      (process.stdout as { write: unknown }).write = filtered;
      (process.stderr as { write: unknown }).write = filtered;
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

  /** Writes a timestamped log line. */
  public log(message: string, current: string | null): void {
    if (this.isTTY) {
      const ts = `${ANSI.dim}${FlowRenderer.timestamp()}${ANSI.reset} `;
      const prefix = current ? `${ANSI.cyan}[${current}]${ANSI.reset} ` : '';
      this.write(`${ts}${prefix}${message}\n`);
    } else {
      const prefix = current ? `[${current}] ` : '';
      this.write(`${FlowRenderer.timestamp()} ${prefix}${message}\n`);
    }
  }

  /** Writes a raw command output line. */
  public command(line: string): void {
    this.write(`${line}\n`);
  }

  /** Updates the dock with new flow state. */
  public update(frame: FlowFrame): void {
    if (this.isTTY) {
      if (!this.scrollRegionActive) this.setupScrollRegion(frame);
      this.updateDock(frame);
    } else {
      this.logNonTtyTransitions(frame);
    }
    this.lastFrame = frame;
  }

  /** Prints an error when the flow could not start (e.g. param validation failed). */
  public failedBeforeStart(flowName: string, err: Error): void {
    if (this.isTTY) this.teardown();
    if (this.isTTY) {
      this.write(`${ANSI.red}${ANSI.bold}✗ Flow "${flowName}" could not start${ANSI.reset}\n`);
    } else {
      this.write(`✗ Flow "${flowName}" could not start\n`);
    }
    this.write('\n');
    for (const line of err.message.split('\n')) this.write(`  ${line}\n`);
    this.write('\n');
  }

  /** Prints the final error summary after all finally steps have run. */
  public flowFailed(flowName: string, stepId: string, err: Error): void {
    if (this.isTTY) this.teardown(this.lastFrame ?? undefined);
    this.write('\n');
    if (this.isTTY) {
      this.write(`${ANSI.red}${ANSI.bold}✗ Flow "${flowName}" failed at step "${stepId}"${ANSI.reset}\n`);
    } else {
      this.write(`✗ Flow "${flowName}" failed at step "${stepId}"\n`);
    }
    this.write('\n');
    for (const line of err.message.split('\n')) this.write(`  ${line}\n`);
    if (!(err instanceof ExpectedError) && err.stack) {
      this.write('\n');
      for (const line of err.stack.split('\n').slice(1)) {
        if (this.isTTY) {
          this.write(`${ANSI.dim}  ${line.trim()}${ANSI.reset}\n`);
        } else {
          this.write(`  ${line.trim()}\n`);
        }
      }
    }
    this.write('\n');
  }

  /** Prints the final success message. */
  public success(frame: FlowFrame): void {
    if (this.isTTY) this.teardown(frame);
    this.write('\n');
    for (const [stepId, message] of frame.ignored) {
      if (this.isTTY) {
        this.write(`  ${ANSI.yellow}${ANSI.bold}⚠ Step "${stepId}" failed (ignored):${ANSI.reset} ${message}\n`);
      } else {
        this.write(`  ⚠ Step "${stepId}" failed (ignored): ${message}\n`);
      }
    }
    if (frame.ignored.size > 0) this.write('\n');
    if (this.isTTY) {
      this.write(`${ANSI.green}${ANSI.bold}✓ Flow "${frame.flowName}" finished successfully!${ANSI.reset}\n`);
    } else {
      this.write(`✓ Flow "${frame.flowName}" finished successfully!\n`);
    }
    this.write('\n');
  }

  private setupScrollRegion(frame: FlowFrame): void {
    this.dockHeight = FlowRenderer.computeDockHeight(frame);
    const rows = process.stdout.rows ?? 24;
    // Scroll to create blank rows at the bottom for the dock
    this.write(`\x1b[${rows};1H`);
    for (let i = 0; i < this.dockHeight; i++) this.write('\n');
    // Restrict scrolling to the region above the dock
    this.write(`\x1b[1;${rows - this.dockHeight}r`);
    // Park cursor at the bottom of the scroll region for normal output
    this.write(`\x1b[${rows - this.dockHeight};1H`);
    this.scrollRegionActive = true;
    this.cleanupHandler = (): void => {
      if (!this.scrollRegionActive) return;
      // Uses this.write (original stdout, bound at construction) to bypass filterRunCommand's patch.
      const r = process.stdout.rows ?? 24;
      this.write('\x1b[r'); // reset scroll region
      this.write(`\x1b[${r - this.dockHeight + 1};1H`); // jump to dock area
      this.write('\x1b[J'); // clear it
      if (this.lastFrame) this.drawDock(this.lastFrame); // redraw as permanent output
      this.scrollRegionActive = false;
    };
    process.on('exit', this.cleanupHandler);
  }

  private updateDock(frame: FlowFrame): void {
    const rows = process.stdout.rows ?? 24;
    this.write('\x1b7'); // DEC save cursor
    this.write(`\x1b[${rows - this.dockHeight + 1};1H`); // jump to dock start
    this.write('\x1b[J'); // clear dock area
    this.drawDock(frame);
    this.write('\x1b8'); // DEC restore cursor
  }

  private drawDock(frame: FlowFrame): void {
    const writeLine = (s: string): void => {
      this.write(`${s}\n`);
    };
    writeLine(`  ${ANSI.dim}${'─'.repeat(40)}${ANSI.reset}`);
    writeLine(`  ${ANSI.dim}Flow:${ANSI.reset} ${ANSI.bold}${frame.flowName}${ANSI.reset}`);
    writeLine(`  ${ANSI.dim}Steps${ANSI.reset}`);
    for (const [stepId, step] of frame.mainSteps) FlowRenderer.renderStepLine(stepId, step, frame, writeLine);

    if (frame.finallySteps.length > 0) {
      writeLine('');
      writeLine(`  ${ANSI.dim}Finally${ANSI.reset}`);
      for (const [stepId, step] of frame.finallySteps) FlowRenderer.renderStepLine(stepId, step, frame, writeLine);
    }
    writeLine('');
  }

  private teardown(frame?: FlowFrame): void {
    if (!this.scrollRegionActive) return;
    if (this.cleanupHandler) {
      process.removeListener('exit', this.cleanupHandler);
      this.cleanupHandler = null;
    }
    const rows = process.stdout.rows ?? 24;
    // Clear the dock rows
    this.write(`\x1b[${rows - this.dockHeight + 1};1H`);
    this.write('\x1b[J');
    // Reset scroll region and position cursor at end of content
    this.write('\x1b[r');
    this.write(`\x1b[${rows - this.dockHeight};1H`);
    this.scrollRegionActive = false;
    if (frame) this.drawDock(frame);
  }

  private logNonTtyTransitions(frame: FlowFrame): void {
    const prev = this.lastFrame;
    if (prev === null) {
      this.write(`Running flow: ${frame.flowName}\n`);
      return;
    }
    if (frame.current && frame.current !== prev.current) {
      this.write(`  → ${frame.current}\n`);
    }
    for (const id of frame.skipped) {
      if (!prev.skipped.has(id)) this.write(`  — ${id} (skipped)\n`);
    }
    for (const [id, msg] of frame.ignored) {
      if (!prev.ignored.has(id)) this.write(`  ⚠ Step "${id}" failed (ignored): ${msg}\n`);
    }
  }
}
