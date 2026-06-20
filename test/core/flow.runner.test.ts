import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { ExpectedError } from '../../src/core/error.js';
import { OrgRegistry } from '../../src/core/org.registry.js';
import type { Task, TaskContext } from '../../src/core/task.definition.schema.js';
import { createFlowContext, type FlowContext } from '../../src/core/flow.context.js';
import type { FlowDefinition } from '../../src/core/flow.definition.schema.js';
import type { runFlow as RunFlowFn } from '../../src/core/flow.runner.js';
import type { Params } from '../../src/core/task.param.schema.js';

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
    public flowFailed(): void {}
    // eslint-disable-next-line class-methods-use-this
    public stepIgnored(): void {}
    // eslint-disable-next-line class-methods-use-this
    public stepSkipped(): void {}
    // eslint-disable-next-line class-methods-use-this
    public success(): void {}
  },
};

function makeContext(params: Params = {}): FlowContext {
  return createFlowContext({
    projectDir: '/',
    shipDir: '/ship',
    config: { project: { slug: 'test' }, dir: '.ship' },
    orgs: new OrgRegistry('/orgs'),
    log: () => {},
    params,
    runCommand: async () => {},
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    name: 'noop',
    description: 'does nothing',
    params: [],
    outputs: [],
    // eslint-disable-next-line @typescript-eslint/require-await
    async run(): Promise<void> {},
    ...overrides,
  };
}

function makeMockRunner(tasks: Record<string, Task>) {
  return {
    TaskRegistry: class {
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
      '../../src/core/task.registry.js': makeMockRunner({
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

  it('throws when a task fails', async () => {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner({
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

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /boom/);
  });

  it('passes resolved params to the task', async () => {
    let receivedParams: Record<string, unknown> = {};

    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner({
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
      '../../src/core/task.registry.js': makeMockRunner({}),
      '../../src/core/flow.renderer.js': mockRenderer,
    });

    const flow: FlowDefinition = {
      params: [{ name: 'env', type: 'string', required: true }],
      steps: { 'my-step': { task: 'noop' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /Missing required params/);
  });

  it('propagates ExpectedError thrown by a task', async () => {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner({
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

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), ExpectedError);
  });
});

describe('runFlow — conditional steps', () => {
  async function loadRunFlow(tasks: Record<string, Task> = {}): Promise<typeof RunFlowFn> {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner(tasks),
      '../../src/core/flow.renderer.js': mockRenderer,
    });
    return runFlow;
  }

  it('skips a step when `if` condition resolves to falsy', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: '${{ params.flag }}' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ flag: '' }));
    assert.deepEqual(ran, []);
  });

  it('runs a step when `if` condition resolves to truthy', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: '${{ params.flag }}' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ flag: 'yes' }));
    assert.deepEqual(ran, ['noop']);
  });

  it('skips a step when `if` condition value does not equal the expected value', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: '${{ params.env }}', equals: 'prod' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ env: 'dev' }));
    assert.deepEqual(ran, []);
  });

  it('runs a step when `if` condition value equals the expected value', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: '${{ params.env }}', equals: 'prod' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ env: 'prod' }));
    assert.deepEqual(ran, ['noop']);
  });

  it('skips a step when `if-not` condition resolves to truthy', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', 'if-not': { value: '${{ params.flag }}' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ flag: 'yes' }));
    assert.deepEqual(ran, []);
  });

  it('runs a step when `if-not` condition resolves to falsy', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', 'if-not': { value: '${{ params.flag }}' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ flag: '' }));
    assert.deepEqual(ran, ['noop']);
  });

  it('skips a step when `if-not` condition value equals the excluded value', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', 'if-not': { value: '${{ params.env }}', equals: 'ci' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ env: 'ci' }));
    assert.deepEqual(ran, []);
  });

  it('runs a step when `if-not` condition value does not equal the excluded value', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', 'if-not': { value: '${{ params.env }}', equals: 'ci' } },
      },
    };

    await runFlow('my-flow', flow, makeContext({ env: 'dev' }));
    assert.deepEqual(ran, ['noop']);
  });

  it('resolves a literal (non-token) string in a condition', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: 'always-truthy' } },
      },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(ran, ['noop']);
  });

  it('treats a missing param token as null (falsy) for `if`', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'conditional-step': { task: 'noop', if: { value: '${{ params.missing }}' } },
      },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(ran, []);
  });
});

describe('runFlow — ignore-failure', () => {
  async function loadRunFlow(tasks: Record<string, Task> = {}): Promise<typeof RunFlowFn> {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner(tasks),
      '../../src/core/flow.renderer.js': mockRenderer,
    });
    return runFlow;
  }

  it('continues the flow when a step fails with ignore-failure', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw new Error('boom');
        },
      }),
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'fail-step': { task: 'fail', 'ignore-failure': true },
        'next-step': { task: 'noop' },
      },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(ran, ['noop']);
  });

  it('sets failed and error on the step output', async () => {
    let receivedParams: Record<string, unknown> = {};
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw new Error('boom');
        },
      }),
      'read-state': makeTask({
        name: 'read-state',
        params: [
          { name: 'failed', type: 'string', required: false },
          { name: 'error', type: 'string', required: false },
        ],
        async run(ctx: TaskContext) {
          receivedParams = ctx.params;
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: {
        'fail-step': { task: 'fail', 'ignore-failure': true },
        'next-step': {
          task: 'read-state',
          params: {
            failed: '${{ steps.fail-step.failed }}',
            error: '${{ steps.fail-step.error }}',
          },
        },
      },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.equal(receivedParams['failed'], 'true');
    assert.equal(receivedParams['error'], 'boom');
  });

  it('still throws when a step fails without ignore-failure', async () => {
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw new Error('boom');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'fail-step': { task: 'fail' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /boom/);
  });
});

describe('runFlow — finally steps', () => {
  async function loadRunFlow(tasks: Record<string, Task> = {}): Promise<typeof RunFlowFn> {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner(tasks),
      '../../src/core/flow.renderer.js': mockRenderer,
    });
    return runFlow;
  }

  it('runs finally steps after all main steps succeed', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      main: makeTask({
        name: 'main',
        async run() {
          ran.push('main');
        },
      }),
      cleanup: makeTask({
        name: 'cleanup',
        async run() {
          ran.push('cleanup');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'main-step': { task: 'main' } },
      finally: { 'cleanup-step': { task: 'cleanup' } },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(ran, ['main', 'cleanup']);
  });

  it('runs finally steps even when a main step fails', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw new Error('boom');
        },
      }),
      cleanup: makeTask({
        name: 'cleanup',
        async run() {
          ran.push('cleanup');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'fail-step': { task: 'fail' } },
      finally: { 'cleanup-step': { task: 'cleanup' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()));
    assert.ok(ran.includes('cleanup'));
  });

  it('ignores failures in finally steps and still throws the original error', async () => {
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw new Error('main error');
        },
      }),
      'cleanup-fail': makeTask({
        name: 'cleanup-fail',
        async run() {
          throw new Error('cleanup error');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'fail-step': { task: 'fail' } },
      finally: { 'cleanup-step': { task: 'cleanup-fail' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /main error/);
  });
});

describe('runFlow — error message formatting', () => {
  async function loadRunFlow(tasks: Record<string, Task> = {}): Promise<typeof RunFlowFn> {
    const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
      '../../src/core/task.registry.js': makeMockRunner(tasks),
      '../../src/core/flow.renderer.js': mockRenderer,
    });
    return runFlow;
  }

  it('uses the cause message when the thrown error has no message of its own', async () => {
    const runFlow = await loadRunFlow({
      fail: makeTask({
        name: 'fail',
        async run() {
          throw Object.assign(new Error(''), { cause: new Error('root cause') });
        },
      }),
    });

    const flow: FlowDefinition = { steps: { 'fail-step': { task: 'fail' } } };
    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /root cause/);
  });

  it('treats a numeric string "0" as falsy in if conditions', async () => {
    const ran: string[] = [];
    const runFlow = await loadRunFlow({
      noop: makeTask({
        name: 'noop',
        async run() {
          ran.push('noop');
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'conditional-step': { task: 'noop', if: { value: '${{ params.count }}' } } },
    };

    await runFlow('my-flow', flow, makeContext({ count: '0' }));
    assert.deepEqual(ran, []);
  });
});
