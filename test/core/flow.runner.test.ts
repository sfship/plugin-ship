import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { resolveTask } from '../../src/core/flow.runner.js';
import { Task } from '../../src/core/task.js';
import type { TaskContext } from '../../src/core/task.js';
import { OrgRegistry } from '../../src/core/org.registry.js';
import type { FlowContext } from '../../src/core/flow.context.js';
import type { FlowDefinition } from '../../src/core/config.js';
import type { runFlow as RunFlowFn } from '../../src/core/flow.runner.js';
import type { Params } from '../../src/core/param.js';

const mockRenderer = {
  FlowRenderer: class {
    // eslint-disable-next-line class-methods-use-this
    public stepStart(): void {}
    // eslint-disable-next-line class-methods-use-this
    public stepComplete(): void {}
    // eslint-disable-next-line class-methods-use-this
    public stepFailed(): void {}
    // eslint-disable-next-line class-methods-use-this
    public success(): void {}
  },
};

function makeContext(params: Params = {}): FlowContext {
  return {
    shipDir: '/ship',
    config: { project: { name: 'test' } },
    orgs: new OrgRegistry('/orgs'),
    log: () => {},
    params,
  };
}

class NoopTask extends Task {
  public readonly name = 'noop';
  public readonly description = 'does nothing';
  public readonly params = [];
  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {}
}

describe('resolveTask', () => {
  it('returns a builtin task by name', async () => {
    const task = new NoopTask();
    const resolved = await resolveTask('noop', '/ship', { noop: task });
    assert.strictEqual(resolved, task);
  });

  it('throws for an unknown task', async () => {
    await assert.rejects(() => resolveTask('unknown/task', '/ship', {}), /Unknown task "unknown\/task"/);
  });
});

describe('runFlow', () => {
  it('runs each step in order', async () => {
    const order: string[] = [];

    class StepATask extends Task {
      public readonly name = 'step-a';
      public readonly description = '';
      public readonly params = [];
      // eslint-disable-next-line class-methods-use-this
      public async run(): Promise<void> {
        order.push('a');
      }
    }

    class StepBTask extends Task {
      public readonly name = 'step-b';
      public readonly description = '';
      public readonly params = [];
      // eslint-disable-next-line class-methods-use-this
      public async run(): Promise<void> {
        order.push('b');
      }
    }

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/tasks/index.js': { default: { 'step-a': new StepATask(), 'step-b': new StepBTask() } },
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      steps: { 'run-a': { task: 'step-a' }, 'run-b': { task: 'step-b' } },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(order, ['a', 'b']);
  });

  it('throws with step and flow name when a task fails', async () => {
    class FailTask extends Task {
      public readonly name = 'fail';
      public readonly description = '';
      public readonly params = [];
      // eslint-disable-next-line class-methods-use-this
      public async run(): Promise<void> {
        throw new Error('boom');
      }
    }

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/tasks/index.js': { default: { fail: new FailTask() } },
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = { steps: { 'my-step': { task: 'fail' } } };

    await assert.rejects(
      () => runFlow('my-flow', flow, makeContext()),
      /Step "my-step" in flow "my-flow" failed: boom/
    );
  });

  it('passes resolved params to the task', async () => {
    let receivedParams: Record<string, unknown> = {};

    class ParamTask extends Task {
      public readonly name = 'param-task';
      public readonly description = '';
      public readonly params = [{ name: 'msg', type: 'string' as const, required: true }];
      // eslint-disable-next-line class-methods-use-this
      public async run(ctx: TaskContext): Promise<void> {
        receivedParams = ctx.params;
      }
    }

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/tasks/index.js': { default: { 'param-task': new ParamTask() } },
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      steps: { 'my-step': { task: 'param-task', params: { msg: '${{ params.greeting }}' } } },
    };

    await runFlow('my-flow', flow, makeContext({ greeting: 'hello' }));
    assert.equal(receivedParams['msg'], 'hello');
  });
});
