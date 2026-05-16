import { FlowStep } from '@plugin-ship/core/flow.definition.schema.js';

export type FlowFrame = {
  flowName: string;
  mainSteps: ReadonlyArray<[string, FlowStep]>;
  finallySteps: ReadonlyArray<[string, FlowStep]>;
  completed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
  ignored: ReadonlyMap<string, string>;
  current: string | null;
  liveLines: string[];
};

export class FlowState {
  private readonly completed = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly skipped = new Set<string>();
  private readonly ignored = new Map<string, string>();
  private currentStep: string | null = null;
  private liveLinesBuf: string[] = [];

  public constructor(
    private readonly flowName: string,
    private readonly mainSteps: Array<[string, FlowStep]>,
    private readonly finallySteps: Array<[string, FlowStep]>
  ) {}

  public get current(): string | null {
    return this.currentStep;
  }

  public stepStart(stepId: string): void {
    this.currentStep = stepId;
  }

  public stepComplete(stepId: string): void {
    this.completed.add(stepId);
    this.currentStep = null;
    this.liveLinesBuf = [];
  }

  public stepFailed(stepId: string): void {
    this.failed.add(stepId);
    this.currentStep = null;
    this.liveLinesBuf = [];
  }

  public stepSkipped(stepId: string): void {
    this.skipped.add(stepId);
    this.liveLinesBuf = [];
  }

  public stepIgnored(stepId: string, message: string): void {
    this.ignored.set(stepId, message);
    this.currentStep = null;
    this.liveLinesBuf = [];
  }

  public setLiveLines(lines: string[]): void {
    this.liveLinesBuf = lines;
  }

  public getFrame(): FlowFrame {
    return {
      flowName: this.flowName,
      mainSteps: this.mainSteps,
      finallySteps: this.finallySteps,
      completed: this.completed,
      failed: this.failed,
      skipped: this.skipped,
      ignored: this.ignored,
      current: this.currentStep,
      liveLines: [...this.liveLinesBuf],
    };
  }
}
