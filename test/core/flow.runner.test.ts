import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { ExpectedError } from '../../src/core/error.utils.js';
import { OrgRegistry } from '../../src/core/org.registry.js';
import type { Task, TaskContext } from '../../src/core/task.js';
import type { FlowContext } from '../../src/core/flow.context.js';
import type { FlowDefinition } from '../../src/core/config.js';
import type { runFlow as RunFlowFn } from '../../src/core/flow.runner.js';
import type { Params } from '../../src/core/param.js';

const mockRenderer = {
  FlowRenderer: class {
    // eslint-disable-next-line class-methods-use-this
    public start(): void {}
    // eslint-disable-next-line class-methods-use-this
    public failedBeforeStart(): void {}
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
    config: { project: { name: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/orgs'),
    log: () => {},
    params,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    name: 'noop',
    description: 'does nothing',
    params: [],
    // eslint-disable-next-line @typescript-eslint/require-await
    async run(): Promise<void> {},
    ...overrides,
  };
}

function makeMockRunner(tasks: Record<string, Task>) {
  return {
    TaskRunner: class {
      // eslint-disable-next-line class-methods-use-this
      public async resolveTask(taskName: string): Promise<Task> {
        const task = tasks[taskName];
        if (!task) throw new Error(`Unknown task "${taskName}"`);
        return task;
      }
    },
  };
}

describe('runFlow', () => {
  it('runs each step in order', async () => {
    const order: string[] = [];

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.runner.js': makeMockRunner({
        'step-a': makeTask({
          name: 'step-a',
          async run() {
            order.push('a');
          },
        }),
        'step-b': makeTask({
          name: 'step-b',
          async run() {
            order.push('b');
          },
        }),
      }),
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      steps: { 'run-a': { task: 'step-a' }, 'run-b': { task: 'step-b' } },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(order, ['a', 'b']);
  });

  it('throws with step and flow name when a task fails', async () => {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.runner.js': makeMockRunner({
        fail: makeTask({
          name: 'fail',
          async run() {
            throw new Error('boom');
          },
        }),
      }),
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

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.runner.js': makeMockRunner({
        'param-task': makeTask({
          name: 'param-task',
          params: [{ name: 'msg', type: 'string', required: true }],
          async run(ctx: TaskContext): Promise<void> {
            receivedParams = ctx.params;
          },
        }),
      }),
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      steps: { 'my-step': { task: 'param-task', params: { msg: '${{ params.greeting }}' } } },
    };

    await runFlow('my-flow', flow, makeContext({ greeting: 'hello' }));
    assert.equal(receivedParams['msg'], 'hello');
  });

  it('throws before any step when a required flow param is missing', async () => {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.runner.js': makeMockRunner({}),
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      params: [{ name: 'env', type: 'string', required: true }],
      steps: { 'my-step': { task: 'noop' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /Missing required params/);
  });

  it('augments ExpectedError with required params hint', async () => {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.runner.js': makeMockRunner({
        'fail-task': makeTask({
          name: 'fail-task',
          params: [{ name: 'msg', type: 'string', required: true }],
          async run() {
            throw new ExpectedError('Missing required params:\n  msg');
          },
        }),
      }),
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = { steps: { 'my-step': { task: 'fail-task' } } };

    await assert.rejects(
      () => runFlow('my-flow', flow, makeContext()),
      /Required params \(add to step "my-step" in ship\.yml\)/
    );
  });
});
