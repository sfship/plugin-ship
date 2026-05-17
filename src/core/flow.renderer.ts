import { StandardColors } from '@salesforce/sf-plugins-core';
import { FlowStep } from './flow.definition.schema.js';
import { FlowContext } from './flow.context.js';
import { ExpectedError } from './util.error.js';
import { formatFlowPlan, formatStepHeading, formatFlowSummary, type FlowOutcome } from './flow.view.js';

type OutputStream = {
  isTTY?: boolean;
  write(chunk: string): boolean;
};

type Steps = ReadonlyArray<readonly [string, FlowStep]>;

/**
 * Renders a flow run as plain sequential output: a plan banner up front, a
 * heading before each step, the step's own (and any subcommand's) output
 * flowing untouched, and a result summary at the end.
 *
 * All formatting lives in the `flow.view` module so a flow looks the same
 * whether it runs here or is inspected via `ship flow info`.
 */
export class FlowRenderer {
  private readonly write: (chunk: string) => boolean;
  private readonly stepsById = new Map<string, FlowStep>();
  private readonly order: string[] = [];
  private readonly completed = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly skipped = new Set<string>();
  private readonly ignored = new Map<string, string>();
  private currentStep: string | null = null;

  public constructor(
    private readonly flowName: string,
    private readonly mainSteps: Steps,
    private readonly finallySteps: Steps,
    ctx: FlowContext,
    out: OutputStream = process.stdout
  ) {
    this.write = out.write.bind(out);
    for (const [id, step] of [...mainSteps, ...finallySteps]) {
      this.stepsById.set(id, step);
      this.order.push(id);
    }
    // The renderer owns presentation, so it takes over the context logger to
    // timestamp lines and prefix them with the step that emitted them.
    // eslint-disable-next-line no-param-reassign
    ctx.log = (message: string): void => this.logLine(message);
  }

  /** The step currently executing, or null between steps. */
  public get activeStep(): string | null {
    return this.currentStep;
  }

  private get outcome(): FlowOutcome {
    return { completed: this.completed, failed: this.failed, skipped: this.skipped, ignored: this.ignored };
  }

  private static timestamp(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /** Prints the plan banner at the start of the run. */
  public start(): void {
    this.write(`${formatFlowPlan(this.flowName, this.mainSteps, this.finallySteps)}\n`);
  }

  /** Prints the heading for a step that is about to run. */
  public stepStart(stepId: string): void {
    this.currentStep = stepId;
    const step = this.stepsById.get(stepId);
    if (!step) return;
    const position = this.order.indexOf(stepId) + 1;
    this.write(`${formatStepHeading(position, this.order.length, stepId, step)}\n`);
  }

  public stepComplete(stepId: string): void {
    this.completed.add(stepId);
    this.currentStep = null;
    this.write(`${StandardColors.success('✓')} ${stepId}\n`);
  }

  public stepFailed(stepId: string): void {
    this.failed.add(stepId);
    this.currentStep = null;
    // The error itself is reported once, with context, in flowFailed().
    this.write(`${StandardColors.error('✗')} ${stepId}\n`);
  }

  public stepSkipped(stepId: string): void {
    this.skipped.add(stepId);
    this.write(`${StandardColors.info('—')} ${stepId} (skipped)\n`);
  }

  public stepIgnored(stepId: string, err: Error): void {
    this.ignored.set(stepId, err.message);
    this.currentStep = null;
    this.write(`${StandardColors.warning('⚠')} ${stepId} (ignored: ${err.message})\n`);
  }

  /** Reports a flow that could not start (e.g. invalid flow params). */
  public failedBeforeStart(err: Error): void {
    this.write(`\n${StandardColors.error(`✗ Flow "${this.flowName}" could not start`)}\n\n`);
    for (const line of err.message.split('\n')) this.write(`  ${line}\n`);
    this.write('\n');
  }

  /** Reports a hard failure: prints the summary, then the error (and stack for unexpected errors). */
  public flowFailed(stepId: string, err: Error): void {
    this.write(`${formatFlowSummary(this.mainSteps, this.finallySteps, this.outcome)}\n`);
    this.write(`\n${StandardColors.error(`✗ Flow "${this.flowName}" failed at step "${stepId}"`)}\n\n`);
    for (const line of err.message.split('\n')) this.write(`  ${line}\n`);
    if (!(err instanceof ExpectedError) && err.stack) {
      this.write('\n');
      for (const line of err.stack.split('\n').slice(1)) this.write(`  ${line.trim()}\n`);
    }
    this.write('\n');
  }

  /** Prints the summary and the success banner. */
  public success(): void {
    this.write(`${formatFlowSummary(this.mainSteps, this.finallySteps, this.outcome)}\n`);
    this.write(`\n${StandardColors.success(`✓ Flow "${this.flowName}" finished successfully!`)}\n\n`);
  }

  /** Handles a user interrupt (Ctrl+C): marks the active step failed and reports it. */
  public interrupt(): void {
    const step = this.currentStep;
    if (step) this.failed.add(step);
    this.currentStep = null;
    this.flowFailed(step ?? '?', new ExpectedError('Interrupted by user.'));
  }

  private logLine(message: string): void {
    const ts = StandardColors.info(FlowRenderer.timestamp());
    const prefix = this.currentStep ? `${StandardColors.info(`[${this.currentStep}]`)} ` : '';
    this.write(`${ts} ${prefix}${message}\n`);
  }
}
