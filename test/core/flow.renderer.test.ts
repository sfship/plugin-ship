import { strict as assert } from 'node:assert';
import { OrgRegistry } from '../../src/core/org.registry.js';
import { FlowRenderer } from '../../src/core/flow.renderer.js';
import type { FlowContext } from '../../src/core/flow.context.js';
import type { FlowStep } from '../../src/core/config.js';

const steps: Array<[string, FlowStep]> = [
  ['step-a', { task: 'util/log' }],
  ['step-b', { task: 'util/log' }],
];

function makeContext(): { ctx: FlowContext; logs: string[] } {
  const logs: string[] = [];
  const ctx: FlowContext = {
    shipDir: '/ship',
    config: { project: { name: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/orgs'),
    log: (msg) => logs.push(msg),
    params: {},
  };
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
  it('logs the flow name on construction', () => {
    const { ctx, logs } = makeContext();
    new FlowRenderer('my-flow', steps, ctx, makeOut(false));
    assert.ok(logs.some((l) => l.includes('my-flow')));
  });

  it('logs each step when it starts', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, ctx, makeOut(false));
    renderer.stepStart('step-a');
    assert.ok(logs.some((l) => l.includes('step-a')));
  });

  it('logs completion on success', () => {
    const { ctx, logs } = makeContext();
    const renderer = new FlowRenderer('my-flow', steps, ctx, makeOut(false));
    renderer.success();
    assert.ok(logs.some((l) => l.includes('my-flow') && l.includes('completed')));
  });
});

describe('FlowRenderer (TTY)', () => {
  it('renders the flow name and steps on construction', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    new FlowRenderer('my-flow', steps, ctx, out);
    const output = out.written.join('');
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('step-b'));
  });

  it('patches context.log to prefix output with the current step', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, ctx, out);
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
    new FlowRenderer('my-flow', steps, ctx, out);
    out.written.length = 0;
    ctx.log('hello');
    assert.ok(out.written.join('').includes('hello'));
  });

  it('re-renders after a step completes', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, ctx, out);
    out.written.length = 0;
    renderer.stepComplete('step-a');
    assert.ok(out.written.join('').includes('step-a'));
  });

  it('writes a success message on success', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, ctx, out);
    out.written.length = 0;
    renderer.success();
    const output = out.written.join('');
    assert.ok(output.includes('my-flow'));
    assert.ok(output.includes('✓'));
  });

  it('writes a failure message on stepFailed', () => {
    const { ctx } = makeContext();
    const out = makeOut(true);
    const renderer = new FlowRenderer('my-flow', steps, ctx, out);
    out.written.length = 0;
    renderer.stepFailed('step-a', new Error('something went wrong'));
    const output = out.written.join('');
    assert.ok(output.includes('step-a'));
    assert.ok(output.includes('something went wrong'));
    assert.ok(output.includes('✗'));
  });
});
