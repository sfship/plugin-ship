import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowStep } from '@plugin-ship/core/flow.definition.js';
import { ExpectedError } from '@plugin-ship/core/error.utils.js';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  clearLine: '\x1b[2K',
  cursorUp: (n: number): string => `\x1b[${n}A`,
};

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

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
  private lastRenderLineCount = 0;
  private readonly tty: boolean | undefined;
  private current: string | null = null;
  private context: FlowContext | null = null;
  private spinnerFrame = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;

  /**
   * @param flowName - The name of the flow being rendered.
   * @param mainSteps - Ordered list of step entries from the flow's `steps` block.
   * @param finallySteps - Ordered list of step entries from the flow's `finally` block.
   * @param context - The flow context for this run.
   * @param out - Output stream. Defaults to `process.stdout`; override in tests to capture output.
   */
  public constructor(
    private readonly flowName: string,
    mainSteps: Array<[string, FlowStep]>,
    finallySteps: Array<[string, FlowStep]>,
    context: FlowContext,
    private readonly out: OutputStream = process.stdout
  ) {
    this.mainSteps = mainSteps;
    this.finallySteps = finallySteps;
    this.context = context;
    this.tty = out.isTTY;
    if (this.tty) {
      // eslint-disable-next-line no-param-reassign
      context.log = (message): void => {
        this.clear();
        const prefix = this.current ? `${ANSI.cyan}[${this.current}]${ANSI.reset} ` : '';
        this.out.write(`${prefix}${message}\n`);
        this.render();
      };
    }
  }

  /** Prints the static flow title. Call once before any steps run. */
  public start(): void {
    if (this.tty) {
      this.out.write(`\n  ${ANSI.dim}Flow:${ANSI.reset} ${ANSI.bold}${this.flowName}${ANSI.reset}\n\n`);
    } else {
      this.context?.log(`Running flow: ${this.flowName}`);
    }
  }

  /** Marks a step as the currently running step. */
  public stepStart(stepId: string): void {
    this.current = stepId;
    if (this.tty) {
      this.spinnerFrame = 0;
      this.clear();
      this.render();
      this.spinnerTimer = setInterval(() => {
        this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER.length;
        this.clear();
        this.render();
      }, 80).unref();
    } else {
      this.context?.log(`  → ${stepId}`);
    }
  }

  /** Marks the current step as completed. */
  public stepComplete(stepId: string): void {
    this.stopSpinner();
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
      this.out.write(`${ANSI.red}${ANSI.bold}✗ Flow "${this.flowName}" could not start${ANSI.reset}\n`);
      this.out.write('\n');
      for (const line of err.message.split('\n')) {
        this.out.write(`  ${line}\n`);
      }
      this.out.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" could not start: ${err.message}`);
    }
  }

  /** Marks a step as skipped due to a falsy condition. */
  public stepSkipped(stepId: string): void {
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
    this.stopSpinner();
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
    this.stopSpinner();
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
      this.out.write('\n');
      this.out.write(`${ANSI.red}${ANSI.bold}✗ Flow "${this.flowName}" failed at step "${stepId}"${ANSI.reset}\n`);
      this.out.write('\n');
      for (const line of err.message.split('\n')) {
        this.out.write(`  ${line}\n`);
      }
      if (!(err instanceof ExpectedError) && err.stack) {
        this.out.write('\n');
        for (const line of err.stack.split('\n').slice(1)) {
          this.out.write(`${ANSI.dim}  ${line.trim()}${ANSI.reset}\n`);
        }
      }
      this.out.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" failed: ${err.message}`);
    }
  }

  /** Prints the final success message. */
  public success(): void {
    if (this.tty) {
      this.out.write('\n');
      for (const [stepId, message] of this.ignored) {
        this.out.write(`  ${ANSI.yellow}${ANSI.bold}⚠ Step "${stepId}" failed (ignored):${ANSI.reset} ${message}\n`);
      }
      if (this.ignored.size > 0) this.out.write('\n');
      this.out.write(`${ANSI.green}${ANSI.bold}✓ Flow "${this.flowName}" finished successfully!${ANSI.reset}\n`);
      this.out.write('\n');
    } else {
      this.context?.log(`Flow "${this.flowName}" completed.`);
    }
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
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
    this.hasRendered = true;
    let lineCount = 0;
    const writeLine = (s: string): void => {
      this.out.write(`${s}\n`);
      lineCount++;
    };

    writeLine(`  ${ANSI.dim}Steps${ANSI.reset}`);
    for (const [stepId, step] of this.mainSteps) this.renderStepLine(stepId, step, writeLine);

    if (this.finallySteps.length > 0) {
      writeLine('');
      writeLine(`  ${ANSI.dim}Finally${ANSI.reset}`);
      for (const [stepId, step] of this.finallySteps) this.renderStepLine(stepId, step, writeLine);
    }

    if (this.current) {
      writeLine('');
      writeLine(`  ${ANSI.yellow}${SPINNER[this.spinnerFrame]}${ANSI.reset}`);
    }

    this.lastRenderLineCount = lineCount;
  }

  private clear(): void {
    if (!this.hasRendered) return;
    for (let i = 0; i < this.lastRenderLineCount; i++) {
      this.out.write(`${ANSI.cursorUp(1)}${ANSI.clearLine}`);
    }
  }
}
