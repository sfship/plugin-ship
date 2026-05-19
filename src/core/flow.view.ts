import { StandardColors } from '@salesforce/sf-plugins-core';
import { FlowStep } from './flow.definition.schema.js';

/** The terminal state of every step in a finished (or failed) flow. */
export type FlowOutcome = {
  completed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
  ignored: ReadonlyMap<string, string>;
};

type Steps = ReadonlyArray<readonly [string, FlowStep]>;

function stepAnnotations(step: FlowStep): string {
  const tags: string[] = [];
  if (step.if) tags.push('if');
  if (step['if-not']) tags.push('if-not');
  if (step['ignore-failure']) tags.push('ignore-failure');
  return tags.length ? ` ${StandardColors.info(`[${tags.join(', ')}]`)}` : '';
}

function planLines(steps: Steps, startIndex: number): string[] {
  return steps.map(
    ([id, step], i) =>
      `  ${String(startIndex + i + 1).padStart(2)}. ${id.padEnd(24)} ${StandardColors.info('→')} ${
        step.task
      }${stepAnnotations(step)}`
  );
}

/**
 * UX formatted flow name + description
 */
export function formatFlowPreview(flowName: string, description?: string): string {
  const header = `${StandardColors.info('Task:')} ${StandardColors.success(flowName)}`;
  return description ? `${header}\n${StandardColors.info('Description:')} ${description}` : header;
}

/** The plan banner printed once when a flow starts. */
export function formatFlowPlan(flowName: string, mainSteps: Steps, finallySteps: Steps): string {
  const lines = [
    `${StandardColors.info('Flow:')} ${StandardColors.success(flowName)}`,
    '',
    StandardColors.info('Steps'),
    ...planLines(mainSteps, 0),
  ];
  if (finallySteps.length > 0) {
    lines.push('', StandardColors.info('Finally'), ...planLines(finallySteps, mainSteps.length));
  }
  return lines.join('\n');
}

/** The heading printed when a step begins. */
export function formatStepHeading(position: number, total: number, stepId: string, step: FlowStep): string {
  return `\n${StandardColors.info(`→ Task [${position}/${total}]`)} ${StandardColors.success(
    stepId
  )} ${StandardColors.info('·')} ${step.task}`;
}

function outcomeLine(stepId: string, outcome: FlowOutcome): string {
  if (outcome.failed.has(stepId)) return `  ${StandardColors.error('✗')} ${stepId}`;
  if (outcome.ignored.has(stepId)) {
    return `  ${StandardColors.warning('⚠')} ${stepId} ${StandardColors.warning(
      `(ignored: ${outcome.ignored.get(stepId) ?? ''})`
    )}`;
  }
  if (outcome.completed.has(stepId)) return `  ${StandardColors.success('✓')} ${stepId}`;
  if (outcome.skipped.has(stepId)) return `  ${StandardColors.info('—')} ${stepId} (skipped)`;
  return `  ${StandardColors.info('○')} ${stepId} (not run)`;
}

/** The result summary printed when a flow ends, success or failure. */
export function formatFlowSummary(mainSteps: Steps, finallySteps: Steps, outcome: FlowOutcome): string {
  const all = [...mainSteps, ...finallySteps];
  const counts = [
    StandardColors.success(`${outcome.completed.size} passed`),
    outcome.failed.size ? StandardColors.error(`${outcome.failed.size} failed`) : `${outcome.failed.size} failed`,
    `${outcome.skipped.size} skipped`,
    outcome.ignored.size
      ? StandardColors.warning(`${outcome.ignored.size} ignored`)
      : `${outcome.ignored.size} ignored`,
  ].join(' · ');
  return ['', StandardColors.info('Flow Summary'), ...all.map(([id]) => outcomeLine(id, outcome)), '', counts].join(
    '\n'
  );
}
