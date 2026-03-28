import { FlowContext } from '@plugin-ship/core/flow.js';
import { FlowStep } from '@plugin-ship/core/config.js';

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

/**
 * Renders a live step checklist in the terminal during a flow run.
 * Attach to a FlowContext to intercept logs and keep the checklist anchored at the bottom.
 */
export class FlowRenderer {
  private readonly steps: Array<[string, FlowStep]>;
  private readonly completed = new Set<string>();
  private current: string | null = null;

  public constructor(private readonly flowName: string, steps: Array<[string, FlowStep]>) {
    this.steps = steps;
  }

  /** Renders the initial checklist and wraps context.log to print above it. */
  public attach(context: FlowContext): void {
    this.render();
    // eslint-disable-next-line no-param-reassign
    context.log = (message): void => {
      this.clear();
      const prefix = this.current ? `${ANSI.cyan}[${this.current}]${ANSI.reset} ` : '';
      process.stdout.write(`${prefix}${message}\n`);
      this.render();
    };
  }

  /** Marks a step as the currently running step and re-renders. */
  public stepStart(stepId: string): void {
    this.current = stepId;
    this.clear();
    this.render();
  }

  /** Marks the current step as completed and re-renders. */
  public stepComplete(stepId: string): void {
    this.completed.add(stepId);
    this.current = null;
    this.clear();
    this.render();
  }

  /** Renders the checklist with the failed step marked, then prints a formatted error. */
  public stepFailed(stepId: string, err: Error): void {
    this.clear();
    this.render(stepId);
    process.stdout.write('\n');
    process.stdout.write(`${ANSI.red}${ANSI.bold}✗ Flow "${this.flowName}" failed at step "${stepId}"${ANSI.reset}\n`);
    process.stdout.write('\n');
    for (const line of err.message.split('\n')) {
      process.stdout.write(`  ${line}\n`);
    }
    if (err.stack) {
      process.stdout.write('\n');
      for (const line of err.stack.split('\n').slice(1)) {
        process.stdout.write(`${ANSI.dim}  ${line.trim()}${ANSI.reset}\n`);
      }
    }
    process.stdout.write('\n');
  }

  /** Prints the final success message. */
  public success(): void {
    process.stdout.write('\n');
    process.stdout.write(`${ANSI.green}${ANSI.bold}✓ Flow "${this.flowName}" finished successfully!${ANSI.reset}\n`);
    process.stdout.write('\n');
  }

  private render(failed: string | null = null): void {
    process.stdout.write(`  ${ANSI.dim}Flow:${ANSI.reset} ${ANSI.bold}${this.flowName}${ANSI.reset}\n`);
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
        marker = '→';
        color = ANSI.yellow;
      } else {
        marker = '○';
        color = ANSI.dim;
      }
      const label = stepId.padEnd(20);
      process.stdout.write(`  ${color}${marker}${ANSI.reset} ${label} ${ANSI.dim}(${step.task})${ANSI.reset}\n`);
    }
  }

  private clear(): void {
    for (let i = 0; i < this.steps.length + 1; i++) {
      process.stdout.write(`${ANSI.cursorUp(1)}${ANSI.clearLine}`);
    }
  }
}
