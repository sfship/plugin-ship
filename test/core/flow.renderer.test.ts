import { strict as assert } from 'node:assert';
import { OrgRegistry } from '../../src/core/org.registry.js';
import { FlowRenderer } from '../../src/core/flow.renderer.js';
import { createFlowContext, type FlowContext } from '../../src/core/flow.context.js';
import type { FlowStep } from '../../src/core/flow.definition.schema.js';

const steps: Array<[string, FlowStep]> = [
  ['step-a', { task: 'util/log' }],
  ['step-b', { task: 'util/log' }],
];

function makeContext(): { ctx: FlowContext; logs: string[] } {
  const logs: string[] = [];
  const ctx = createFlowContext({
    shipDir: '/ship',
    config: { project: { name: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/orgs'),
    log: (msg: string) => logs.push(msg),
    params: {},
  });
  return { ctx, logs };
}

function makeOut(isTTY: boolean): { isTTY: boolean; write: (chunk: string) => boolean; written: string[] } {
  const written: string[] = [];
  return {
    isTTY,
    write: (chunk) => {
      written.push(chunk);
      return true;
    },
    written,
  };
}

describe('FlowRenderer (non-TTY)', () => {
  it('logs the flow name on start', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.start();
    assert.ok(logs.some((l) => l.includes('my-flow')));
  });

  it('logs each step when it starts', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.stepStart('step-a');
    assert.ok(logs.some((l) => l.includes('step-a')));
  });

  it('logs completion on success', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.success();
    assert.ok(logs.some((l) => l.includes('my-flow') && l.includes('completed')));
  });

  it('logs a could not start message on failedBeforeStart', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.failedBeforeStart(new Error('bad param'));
    assert.ok(logs.some((l) => l.includes('could not start') && l.includes('bad param')));
  });

  it('logs the failed step on stepFailed', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.stepFailed('step-a', new Error('something went wrong'));
    assert.ok(logs.some((l) => l.includes('step-a') && l.includes('something went wrong')));
  });

  it('logs the flow failed message on flowFailed', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.flowFailed('step-a', new Error('something went wrong'));
    assert.ok(logs.some((l) => l.includes('my-flow') && l.includes('something went wrong')));
  });
});

describe('FlowRenderer (TTY)', () => {
  it('renders the flow name on start', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.start();
    assert.ok(out.written.join('').includes('my-flow'));
  });

  it('renders the step list when the first step starts', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.start();
    out.written.length = 0;
    renderer.stepStart('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('step-b'));
  });

  it('patches context.log to prefix output with the current step', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.stepStart('step-a');
    out.written.length = 0;
    ctx.log('hello');
    const output = out.written.join('');
    assert.ok(output.includes('hello'));
    assert.ok(output.includes('step-a'));
  });

  it('patches context.log with no prefix when no step is active', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    ctx.log('hello');
    assert.ok(out.written.join('').includes('hello'));
  });

  it('re-renders after a step completes', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    renderer.stepComplete('step-a');
    assert.ok(out.written.join('').includes('step-a'));
  });

  it('writes a success message on success', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('✓'));
  });

  it('marks the step with ✗ on stepFailed', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    renderer.stepFailed('step-a', new Error('something went wrong'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('✗'));
    assert.ok(!output.includes('something went wrong'));
  });

  it('prints the error message and step name on flowFailed', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    renderer.flowFailed('step-a', new Error('something went wrong'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('something went wrong'));
    assert.ok(output.includes('✗'));
  });

  it('stops the spinner and renders failure when stepFailed is called after stepStart', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.stepStart('step-a');
    out.written.length = 0;
    renderer.stepFailed('step-a', new Error('oops'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('✗'));
  });

  it('renders the Finally section when finallySteps are provided', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const finallySteps: Array<[string, FlowStep]> = [['cleanup', { task: 'util/log' }]];
    const renderer = new FlowRenderer('my-flow', steps, finallySteps, ctx, out);
    renderer.stepStart('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('Finally'));
    assert.ok(output.includes('cleanup'));
  });

  it('writes a failedBeforeStart message with the error', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.start();
    out.written.length = 0;
    renderer.failedBeforeStart(new Error('bad param\ndetail'));
    const output = out.written.join('');
    assert.ok(output.includes('could not start'));
    assert.ok(output.includes('bad param'));
  });

  it('renders (skipped) instead of the task name for a skipped step', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.start();
    out.written.length = 0;
    renderer.stepSkipped('step-a');
    // Each step is written as a separate chunk — find the line for step-a
    const stepALine = out.written.find((chunk) => chunk.includes('step-a'));
    assert.ok(stepALine, 'step-a should be rendered');
    assert.ok(stepALine.includes('(skipped)'), 'skipped step should show (skipped)');
    assert.ok(!stepALine.includes('util/log'), 'skipped step should not show the task name');
  });
});

describe('FlowRenderer (non-TTY) — stepSkipped', () => {
  it('logs the skipped message for a step', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.stepSkipped('step-a');
    assert.ok(logs.some((l) => l.includes('step-a') && l.includes('skipped')));
  });
});

describe('FlowRenderer — stepIgnored', () => {
  it('logs the ignored failure in non-TTY mode', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, makeOut(false));
    renderer.stepIgnored('step-a', new Error('oops'));
    assert.ok(logs.some((l) => l.includes('step-a') && l.includes('oops') && l.includes('ignored')));
  });

  it('renders the ⚠ marker for the ignored step in TTY mode', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.stepStart('step-a');
    out.written.length = 0;
    renderer.stepIgnored('step-a', new Error('oops'));
    const stepALine = out.written.find((chunk) => chunk.includes('step-a'));
    assert.ok(stepALine, 'step-a should be rendered');
    assert.ok(stepALine.includes('⚠'));
  });

  it('includes the ignored step warning in the success summary', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.stepIgnored('step-a', new Error('something went wrong'));
    out.written.length = 0;
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('something went wrong'));
    assert.ok(output.includes('⚠'));
    assert.ok(output.includes('✓'));
  });
});
