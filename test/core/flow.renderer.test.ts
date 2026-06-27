import { strict as assert } from 'node:assert';
import { OrgRegistry } from '../../src/core/org.registry.js';
import { FlowRenderer } from '../../src/core/flow.renderer.js';
import { createFlowContext, type FlowContext } from '../../src/core/flow.context.js';
import type { FlowStep } from '../../src/core/flow.definition.schema.js';

const steps: Array<[string, FlowStep]> = [
  ['step-a', { task: 'util/log' }],
  ['step-b', { task: 'util/log' }],
];

function makeContext(): FlowContext {
  return createFlowContext({
    projectDir: '/',
    shipDir: '/ship',
    config: { project: { slug: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/orgs'),
    log: () => {},
    params: {},
    runCommand: async () => {},
  });
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

describe('FlowRenderer — plan', () => {
  it('prints the flow name and every step in the plan on start()', () => {
    const out = makeOut(true);
    new FlowRenderer('my-flow', steps, [], makeContext(), out).start();
    const output = out.written.join('');
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('step-b'));
  });

  it('prints a Finally section when finally steps are provided', () => {
    const out = makeOut(true);
    const finallySteps: Array<[string, FlowStep]> = [['cleanup', { task: 'util/log' }]];
    new FlowRenderer('my-flow', steps, finallySteps, makeContext(), out).start();
    const output = out.written.join('');
    assert.ok(output.includes('Finally'));
    assert.ok(output.includes('cleanup'));
  });

  it('works without color in a non-TTY stream', () => {
    const out = makeOut(false);
    new FlowRenderer('my-flow', steps, [], makeContext(), out).start();
    assert.ok(out.written.join('').includes('my-flow'));
  });
});

describe('FlowRenderer — step lifecycle', () => {
  it('prints a heading with the step id and task when a step starts', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.stepStart('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('util/log'));
  });

  it('ignores stepStart for an unknown step id without throwing', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    assert.doesNotThrow(() => renderer.stepStart('does-not-exist'));
    assert.ok(!out.written.join('').includes('does-not-exist'));
  });

  it('marks a completed step with ✓', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.stepComplete('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('✓'));
  });

  it('marks a failed step with a concise ✗ line (error is reported later)', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.stepFailed('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('✗'));
  });

  it('renders (skipped) without the task name for a skipped step', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.stepSkipped('step-a');
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('(skipped)'));
    assert.ok(!output.includes('util/log'));
  });

  it('renders ⚠ and the message for an ignored step', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.stepIgnored('step-a', new Error('oops'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('⚠'));
    assert.ok(output.includes('oops'));
    assert.ok(output.includes('ignored'));
  });
});

describe('FlowRenderer — context log', () => {
  it('prefixes log output with the active step', () => {
    const ctx = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], ctx, out);
    renderer.stepStart('step-a');
    out.written.length = 0;
    ctx.log('hello');
    const output = out.written.join('');
    assert.ok(output.includes('hello'));
    assert.ok(output.includes('step-a'));
  });

  it('logs with no step prefix when no step is active', () => {
    const ctx = makeContext();
    const out = makeOut(true);
    new FlowRenderer('my-flow', steps, [], ctx, out);
    out.written.length = 0;
    ctx.log('hello');
    const output = out.written.join('');
    assert.ok(output.includes('hello'));
    assert.ok(!output.includes('[step'));
  });
});

describe('FlowRenderer — terminal states', () => {
  it('prints the summary and a success banner on success()', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    renderer.stepComplete('step-a');
    out.written.length = 0;
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('✓'));
    assert.ok(output.includes('finished successfully'));
    assert.ok(output.includes('step-a'));
  });

  it('includes an ignored step (with its message) in the success summary', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    renderer.stepIgnored('step-a', new Error('something went wrong'));
    out.written.length = 0;
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('something went wrong'));
    assert.ok(output.includes('⚠'));
    assert.ok(output.includes('✓'));
  });

  it('prints the summary, step, and error on flowFailed()', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    renderer.stepComplete('step-a');
    renderer.stepFailed('step-b');
    out.written.length = 0;
    renderer.flowFailed('step-b', new Error('something went wrong'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('step-b'));
    assert.ok(output.includes('something went wrong'));
    assert.ok(output.includes('✗'));
  });

  it('prints a stack trace for an unexpected (non-ExpectedError) failure', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    const err = new Error('boom');
    renderer.flowFailed('step-a', err);
    const output = out.written.join('');
    assert.ok(output.includes('boom'));
    assert.ok(output.includes(' at '));
  });

  it('writes a could-not-start message with the error on failedBeforeStart()', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.failedBeforeStart(new Error('bad param\ndetail'));
    const output = out.written.join('');
    assert.ok(output.includes('could not start'));
    assert.ok(output.includes('bad param'));
    assert.ok(output.includes('detail'));
  });

  it('reports a user interrupt for the active step', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    renderer.stepStart('step-a');
    out.written.length = 0;
    renderer.interrupt();
    const output = out.written.join('');
    assert.ok(output.includes('Interrupted by user.'));
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('✗'));
  });

  it('reports an interrupt with no active step', () => {
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    out.written.length = 0;
    renderer.interrupt();
    assert.ok(out.written.join('').includes('Interrupted by user.'));
  });
});

describe('FlowRenderer — non-TTY', () => {
  it('still reports lifecycle events without a TTY', () => {
    const out = makeOut(false);
    const renderer = new FlowRenderer('my-flow', steps, [], makeContext(), out);
    renderer.stepStart('step-a');
    renderer.stepComplete('step-a');
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('finished successfully'));
  });
});
