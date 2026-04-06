import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowStep } from '@plugin-ship/core/config.js';
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
  private readonly steps: Array<[string, FlowStep]>;
  private readonly completed = new Set<string>();
  private readonly tty: boolean | undefined;
  private current: string | null = null;
  private context: FlowContext | null = null;
  private spinnerFrame = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;

  /**
   * @param flowName - The name of the flow being rendered.
   * @param steps - Ordered list of step entries from the flow definition.
   * @param context - The flow context for this run.
   * @param out - Output stream. Defaults to `process.stdout`; override in tests to capture output.
   */
  public constructor(
    private readonly flowName: string,
    steps: Array<[string, FlowStep]>,
    context: FlowContext,
    private readonly out: OutputStream = process.stdout
  ) {
    this.steps = steps;
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
        this.spinnerFrame = (this.spinnerFrame + 1) % 10;
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

  /** Marks a step as failed and prints the error. */
  public stepFailed(stepId: string, err: Error): void {
    this.stopSpinner();
    if (this.tty) {
      this.clear();
      this.render(stepId);
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
    }
  }

  /** Prints the final success message. */
  public success(): void {
    if (this.tty) {
      this.out.write('\n');
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

  private render(failed: string | null = null): void {
    for (const [stepId, step] of this.steps) {
      let marker: string;
      let color: string;
      if (stepId === failed) {
        marker = '✗';
        color = ANSI.red;
      } else if (this.completed.has(stepId)) {
        marker = '✓';
        color = ANSI.green;
      } else if (stepId === this.current) {
        marker = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[this.spinnerFrame];
        color = ANSI.yellow;
      } else {
        marker = '○';
        color = ANSI.dim;
      }
      const label = stepId.padEnd(20);
      this.out.write(`  ${color}${marker}${ANSI.reset} ${label} ${ANSI.dim}(${step.task})${ANSI.reset}\n`);
    }
  }

  private clear(): void {
    this.steps.forEach(() => {
      this.out.write(`${ANSI.cursorUp(1)}${ANSI.clearLine}`);
    });
  }
}
