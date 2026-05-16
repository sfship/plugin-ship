import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowStep } from '@plugin-ship/core/flow.definition.schema.js';
import { ExpectedError } from '@plugin-ship/core/util.error.js';
import { wrapRunCommand } from '@plugin-ship/core/util.command.js';

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

/**
 * Renders a live step checklist in TTY environments, or falls back to plain log
 * output in non-TTY environments (e.g. CI). The flow runner always calls the same
 * API — rendering mode is an internal detail of this class.
 */
export class FlowRenderer {
  private readonly mainSteps: Array<[string, FlowStep]>;
  private readonly finallySteps: Array<[string, FlowStep]>;
  private readonly completed = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly skipped = new Set<string>();
  private readonly ignored = new Map<string, string>();
  private hasRendered = false;
  private liveLines: string[] = [];
  private readonly tty: boolean | undefined;
  private current: string | null = null;
  private context: FlowContext | null = null;

  /**
   * @param flowName - The name of the flow being rendered.
   * @param mainSteps - Ordered list of step entries from the flow's `steps` block.
   * @param finallySteps - Ordered list of step entries from the flow's `finally` block.
   * @param context - The flow context for this run.
   * @param out - Output stream. Defaults to `process.stdout`; override in tests to capture output.
   */
  private readonly write: (chunk: string) => boolean;

  public constructor(
    private readonly flowName: string,
    mainSteps: Array<[string, FlowStep]>,
    finallySteps: Array<[string, FlowStep]>,
    context: FlowContext,
    out: OutputStream = process.stdout
  ) {
    this.write = out.write.bind(out);
    this.mainSteps = mainSteps;
    this.finallySteps = finallySteps;
    this.context = context;
    this.tty = out.isTTY;
    const originalLog = context.log;
    if (this.tty) {
      // eslint-disable-next-line no-param-reassign
      context.log = (message): void => {
        this.clear();
        const ts = `${ANSI.dim}${FlowRenderer.timestamp()}${ANSI.reset} `;
        const prefix = this.current ? `${ANSI.cyan}[${this.current}]${ANSI.reset} ` : '';
        this.write(`${ts}${prefix}${message}\n`);
        this.render();
      };
      // eslint-disable-next-line no-param-reassign
      context.runCommand = wrapRunCommand(context.runCommand, context.log, (lines) => {
        this.liveLines = lines;
        if (lines.length > 0) {
          this.clear();
          this.render();
        }
      });
    } else {
      // eslint-disable-next-line no-param-reassign
      context.log = (message): void => originalLog(`${FlowRenderer.timestamp()} ${message}`);
      // eslint-disable-next-line no-param-reassign
      context.runCommand = wrapRunCommand(context.runCommand, context.log);
    }
  }

  private static timestamp(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /** Prints the initial render. Call once before any steps run. */
  public start(): void {
    if (this.tty) {
      this.render();
    } else {
      this.context?.log(`Running flow: ${this.flowName}`);
    }
  }

  /** Marks a step as the currently running step. */
  public stepStart(stepId: string): void {
    this.current = stepId;
    if (this.tty) {
      this.clear();
      this.render();
    } else {
      this.context?.log(`  → ${stepId}`);
    }
  }

  /** Marks the current step as completed. */
  public stepComplete(stepId: string): void {
    this.liveLines = [];
    this.completed.add(stepId);
    this.current = null;
    if (this.tty) {
      this.clear();
      this.render();
    }
  }

  /** Prints an error when the flow could not start (e.g. param validation failed). */
  public failedBeforeStart(err: Error): void {
    if (this.tty) {
      this.write(`${ANSI.red}${ANSI.bold}✗ Flow "${this.flowName}" could not start${ANSI.reset}\n`);
      this.write('\n');
      for (const line of err.message.split('\n')) {
        this.write(`  ${line}\n`);
      }
      this.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" could not start: ${err.message}`);
    }
  }

  /** Marks a step as skipped due to a falsy condition. */
  public stepSkipped(stepId: string): void {
    this.liveLines = [];
    this.skipped.add(stepId);
    if (this.tty) {
      this.clear();
      this.render();
    } else {
      this.context?.log(`  — ${stepId} (skipped)`);
    }
  }

  /** Marks a step as failed but ignored; warning is deferred to the success summary. */
  public stepIgnored(stepId: string, err: Error): void {
    this.liveLines = [];
    this.ignored.set(stepId, err.message);
    this.current = null;
    if (this.tty) {
      this.clear();
      this.render();
    } else {
      this.context?.log(`  ⚠ Step "${stepId}" failed (ignored): ${err.message}`);
    }
  }

  /** Marks a step as failed in the checklist. Call flowFailed() after finally steps complete to print the error. */
  public stepFailed(stepId: string, err: Error): void {
    this.liveLines = [];
    this.failed.add(stepId);
    this.current = null;
    if (this.tty) {
      this.clear();
      this.render();
    } else {
      this.context?.log(`  ✗ ${stepId} failed: ${err.message}`);
    }
  }

  /** Prints the final error summary after all finally steps have run. */
  public flowFailed(stepId: string, err: Error): void {
    if (this.tty) {
      this.write('\n');
      this.write(`${ANSI.red}${ANSI.bold}✗ Flow "${this.flowName}" failed at step "${stepId}"${ANSI.reset}\n`);
      this.write('\n');
      for (const line of err.message.split('\n')) {
        this.write(`  ${line}\n`);
      }
      if (!(err instanceof ExpectedError) && err.stack) {
        this.write('\n');
        for (const line of err.stack.split('\n').slice(1)) {
          this.write(`${ANSI.dim}  ${line.trim()}${ANSI.reset}\n`);
        }
      }
      this.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" failed: ${err.message}`);
    }
  }

  /** Prints the final success message. */
  public success(): void {
    if (this.tty) {
      this.write('\n');
      for (const [stepId, message] of this.ignored) {
        this.write(`  ${ANSI.yellow}${ANSI.bold}⚠ Step "${stepId}" failed (ignored):${ANSI.reset} ${message}\n`);
      }
      if (this.ignored.size > 0) this.write('\n');
      this.write(`${ANSI.green}${ANSI.bold}✓ Flow "${this.flowName}" finished successfully!${ANSI.reset}\n`);
      this.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" completed.`);
    }
  }

  private renderStepLine(stepId: string, step: FlowStep, writeLine: (s: string) => void): void {
    let marker: string;
    let color: string;
    if (this.failed.has(stepId)) {
      marker = '✗';
      color = ANSI.red;
    } else if (this.ignored.has(stepId)) {
      marker = '⚠';
      color = ANSI.yellow;
    } else if (this.completed.has(stepId)) {
      marker = '✓';
      color = ANSI.green;
    } else if (this.skipped.has(stepId)) {
      marker = '—';
      color = ANSI.dim;
    } else if (stepId === this.current) {
      marker = '→';
      color = ANSI.cyan;
    } else {
      marker = '○';
      color = ANSI.dim;
    }
    const label = stepId.padEnd(20);
    const detail = this.skipped.has(stepId) ? 'skipped' : step.task;
    writeLine(`  ${color}${marker}${ANSI.reset} ${label} ${ANSI.dim}(${detail})${ANSI.reset}`);
  }

  private render(): void {
    this.write('\x1b[s'); // save cursor position
    this.hasRendered = true;
    const writeLine = (s: string): void => {
      this.write(`${s}\n`);
    };

    if (this.liveLines.length > 0) {
      const checklistHeight =
        3 + this.mainSteps.length + (this.finallySteps.length > 0 ? 1 + this.finallySteps.length : 0);
      const rows = process.stdout.rows ?? 24;
      const maxLive = Math.max(1, rows - checklistHeight - 2);
      const visibleLines = this.liveLines.slice(-maxLive);
      const ts = `${ANSI.dim}${FlowRenderer.timestamp()}${ANSI.reset} `;
      const prefix = this.current ? `${ANSI.cyan}[${this.current}]${ANSI.reset} ` : '';
      for (const line of visibleLines) writeLine(`${ts}${prefix}${line}`);
      writeLine('');
    }

    writeLine(`  ${ANSI.dim}${'─'.repeat(40)}${ANSI.reset}`);
    writeLine(`  ${ANSI.dim}Flow:${ANSI.reset} ${ANSI.bold}${this.flowName}${ANSI.reset}`);
    writeLine(`  ${ANSI.dim}Steps${ANSI.reset}`);
    for (const [stepId, step] of this.mainSteps) this.renderStepLine(stepId, step, writeLine);

    if (this.finallySteps.length > 0) {
      writeLine('');
      writeLine(`  ${ANSI.dim}Finally${ANSI.reset}`);
      for (const [stepId, step] of this.finallySteps) this.renderStepLine(stepId, step, writeLine);
    }
  }

  private clear(): void {
    if (!this.hasRendered) return;
    this.write('\x1b[u'); // restore saved cursor position
    this.write('\x1b[J'); // erase from cursor to end of screen
    this.hasRendered = false;
  }
}
