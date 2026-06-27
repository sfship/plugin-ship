/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable class-methods-use-this */

import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { ExpectedError } from '../../src/core/error.js';
import { OrgRegistry } from '../../src/core/org.registry.js';
import type { Task } from '../../src/core/task.definition.schema.js';
import { createFlowContext, type FlowContext } from '../../src/core/flow.context.js';
import type { FlowDefinition, FlowStep } from '../../src/core/flow.definition.schema.js';
import type { FlowRenderer } from '../../src/core/flow.renderer.js';
import { handleUncaught, type runFlow as RunFlowFn } from '../../src/core/flow.runner.js';
import type { Params } from '../../src/core/task.param.schema.js';

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
    async run(): Promise<void> {},
    ...overrides,
  };
}

/** A task that records its own name into `log` when it runs. */
function recordingTask(name: string, log: string[]): Task {
  return makeTask({
    name,
    async run() {
      log.push(name);
    },
  });
}

/** A task that always throws, for exercising failure paths. */
function failingTask(name: string, message = 'boom'): Task {
  return makeTask({
    name,
    async run() {
      throw new Error(message);
    },
  });
}

function makeMockRunner(tasks: Record<string, Task>) {
  return {
    TaskRegistry: class {
      public async resolveTask(taskName: string): Promise<Task> {
        const task = tasks[taskName];
        if (!task) throw new Error(`Unknown task "${taskName}"`);
        return task;
      }
    },
  };
}

/**
 * A no-op FlowRenderer mock that records the name of each method called on it.
 * A Proxy stands in for every method, so new renderer methods need no changes
 * here; `activeStep` is exposed as a real (null) property for handleUncaught.
 */
function makeRenderer(calls: string[] = []): { FlowRenderer: new (...args: unknown[]) => object } {
  class MockRenderer {
    public activeStep: string | null = null;
    public constructor() {
      return new Proxy(this, {
        get(target, prop, receiver) {
          if (typeof prop === 'symbol' || prop in target) return Reflect.get(target, prop, receiver);
          return () => calls.push(prop);
        },
      });
    }
  }
  return { FlowRenderer: MockRenderer };
}

function recordingRenderer(calls: string[] = []): FlowRenderer {
  return new (makeRenderer(calls).FlowRenderer)() as unknown as FlowRenderer;
}

/** Loads `runFlow` with the task registry and renderer stubbed out. */
async function loadRunFlow(tasks: Record<string, Task> = {}): Promise<typeof RunFlowFn> {
  const { runFlow }: { runFlow: typeof RunFlowFn } = await esmock('../../src/core/flow.runner.js', {
    '../../src/core/task.registry.js': makeMockRunner(tasks),
    '../../src/core/flow.renderer.js': makeRenderer(),
  });
  return runFlow;
}

describe('runFlow', () => {
  it('runs each step in order', async () => {
    const log: string[] = [];
    const runFlow = await loadRunFlow({
      'step-a': recordingTask('step-a', log),
      'step-b': recordingTask('step-b', log),
    });

    const flow: FlowDefinition = {
      steps: { 'run-a': { task: 'step-a' }, 'run-b': { task: 'step-b' } },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(log, ['step-a', 'step-b']);
  });

  it('throws when a task fails', async () => {
    const runFlow = await loadRunFlow({ fail: failingTask('fail') });
    const flow: FlowDefinition = { steps: { 'my-step': { task: 'fail' } } };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /boom/);
  });

  it('passes resolved params to the task', async () => {
    let received: Params = {};
    const runFlow = await loadRunFlow({
      'param-task': makeTask({
        name: 'param-task',
        params: [{ name: 'msg', type: 'string', required: true }],
        async run(ctx) {
          received = ctx.params;
        },
      }),
    });

    const flow: FlowDefinition = {
      steps: { 'my-step': { task: 'param-task', params: { msg: '${{ params.greeting }}' } } },
    };

    await runFlow('my-flow', flow, makeContext({ greeting: 'hello' }));
    assert.equal(received['msg'], 'hello');
  });

  it('throws before any step when a required flow param is missing', async () => {
    const runFlow = await loadRunFlow();
    const flow: FlowDefinition = {
      params: [{ name: 'env', type: 'string', required: true }],
      steps: { 'my-step': { task: 'noop' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /Missing required params/);
  });

  it('propagates an ExpectedError thrown by a task', async () => {
    const runFlow = await loadRunFlow({
      'fail-task': makeTask({
        name: 'fail-task',
        async run() {
          throw new ExpectedError('user-facing failure');
        },
      }),
    });

    const flow: FlowDefinition = { steps: { 'my-step': { task: 'fail-task' } } };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), ExpectedError);
  });
});

describe('runFlow — conditional steps', () => {
  type ConditionCase = {
    name: string;
    condition: Pick<FlowStep, 'if' | 'if-not'>;
    params?: Params;
    runs: boolean;
  };

  const cases: ConditionCase[] = [
    {
      name: 'skips when `if` resolves falsy',
      condition: { if: { value: '${{ params.flag }}' } },
      params: { flag: '' },
      runs: false,
    },
    {
      name: 'runs when `if` resolves truthy',
      condition: { if: { value: '${{ params.flag }}' } },
      params: { flag: 'yes' },
      runs: true,
    },
    {
      name: 'skips when `if` value !== equals',
      condition: { if: { value: '${{ params.env }}', equals: 'prod' } },
      params: { env: 'dev' },
      runs: false,
    },
    {
      name: 'runs when `if` value === equals',
      condition: { if: { value: '${{ params.env }}', equals: 'prod' } },
      params: { env: 'prod' },
      runs: true,
    },
    {
      name: 'skips when `if-not` resolves truthy',
      condition: { 'if-not': { value: '${{ params.flag }}' } },
      params: { flag: 'yes' },
      runs: false,
    },
    {
      name: 'runs when `if-not` resolves falsy',
      condition: { 'if-not': { value: '${{ params.flag }}' } },
      params: { flag: '' },
      runs: true,
    },
    {
      name: 'skips when `if-not` value === equals',
      condition: { 'if-not': { value: '${{ params.env }}', equals: 'ci' } },
      params: { env: 'ci' },
      runs: false,
    },
    {
      name: 'runs when `if-not` value !== equals',
      condition: { 'if-not': { value: '${{ params.env }}', equals: 'ci' } },
      params: { env: 'dev' },
      runs: true,
    },
    {
      name: 'resolves a literal (non-token) string as truthy',
      condition: { if: { value: 'always-truthy' } },
      runs: true,
    },
    {
      name: 'treats a missing param token as falsy for `if`',
      condition: { if: { value: '${{ params.missing }}' } },
      runs: false,
    },
    {
      name: 'treats the numeric string "0" as falsy for `if`',
      condition: { if: { value: '${{ params.count }}' } },
      params: { count: '0' },
      runs: false,
    },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const log: string[] = [];
      const runFlow = await loadRunFlow({ noop: recordingTask('noop', log) });
      const flow: FlowDefinition = { steps: { step: { task: 'noop', ...c.condition } } };

      await runFlow('my-flow', flow, makeContext(c.params));
      assert.deepEqual(log, c.runs ? ['noop'] : []);
    });
  }
});

describe('runFlow — ignore-failure', () => {
  it('continues the flow when a step fails with ignore-failure', async () => {
    const log: string[] = [];
    const runFlow = await loadRunFlow({ fail: failingTask('fail'), noop: recordingTask('noop', log) });

    const flow: FlowDefinition = {
      steps: {
        'fail-step': { task: 'fail', 'ignore-failure': true },
        'next-step': { task: 'noop' },
      },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(log, ['noop']);
  });

  it('exposes failed and error on the ignored step output', async () => {
    let received: Params = {};
    const runFlow = await loadRunFlow({
      fail: failingTask('fail'),
      'read-state': makeTask({
        name: 'read-state',
        params: [
          { name: 'failed', type: 'string', required: false },
          { name: 'error', type: 'string', required: false },
        ],
        async run(ctx) {
          received = ctx.params;
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
    assert.equal(received['failed'], 'true');
    assert.equal(received['error'], 'boom');
  });

  it('still throws when a step fails without ignore-failure', async () => {
    const runFlow = await loadRunFlow({ fail: failingTask('fail') });
    const flow: FlowDefinition = { steps: { 'fail-step': { task: 'fail' } } };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /boom/);
  });
});

describe('runFlow — finally steps', () => {
  it('runs finally steps after all main steps succeed', async () => {
    const log: string[] = [];
    const runFlow = await loadRunFlow({ main: recordingTask('main', log), cleanup: recordingTask('cleanup', log) });

    const flow: FlowDefinition = {
      steps: { 'main-step': { task: 'main' } },
      finally: { 'cleanup-step': { task: 'cleanup' } },
    };

    await runFlow('my-flow', flow, makeContext());
    assert.deepEqual(log, ['main', 'cleanup']);
  });

  it('runs finally steps even when a main step fails', async () => {
    const log: string[] = [];
    const runFlow = await loadRunFlow({ fail: failingTask('fail'), cleanup: recordingTask('cleanup', log) });

    const flow: FlowDefinition = {
      steps: { 'fail-step': { task: 'fail' } },
      finally: { 'cleanup-step': { task: 'cleanup' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()));
    assert.ok(log.includes('cleanup'));
  });

  it('ignores failures in finally steps and still throws the original error', async () => {
    const runFlow = await loadRunFlow({
      fail: failingTask('fail', 'main error'),
      'cleanup-fail': failingTask('cleanup-fail', 'cleanup error'),
    });

    const flow: FlowDefinition = {
      steps: { 'fail-step': { task: 'fail' } },
      finally: { 'cleanup-step': { task: 'cleanup-fail' } },
    };

    await assert.rejects(() => runFlow('my-flow', flow, makeContext()), /main error/);
  });
});

describe('runFlow — error message formatting', () => {
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
});

describe('handleUncaught', () => {
  class ProcessExitError extends Error {
    public readonly code: number;
    public constructor(code: number) {
      super(`process.exit(${code})`);
      this.code = code;
    }
  }

  let savedExit: typeof process.exit;
  let savedStdoutWrite: typeof process.stdout.write;
  let savedStderrWrite: typeof process.stderr.write;

  beforeEach(() => {
    savedExit = process.exit.bind(process);
    savedStdoutWrite = process.stdout.write.bind(process.stdout);
    savedStderrWrite = process.stderr.write.bind(process.stderr);
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;
  });

  afterEach(() => {
    process.exit = savedExit;
    process.stdout.write = savedStdoutWrite;
    process.stderr.write = savedStderrWrite;
  });

  /** Builds an oclif-style EEXIT error, optionally carrying an exit code. */
  function eexit(exit?: number): Error {
    return Object.assign(new Error('oclif exit'), {
      code: 'EEXIT',
      oclif: exit === undefined ? undefined : { exit },
    });
  }

  function assertExits(fn: () => void, code: number): void {
    assert.throws(fn, (e: unknown) => e instanceof ProcessExitError && e.code === code);
  }

  it('calls interrupt and exits 130 on Ctrl+C (EEXIT 130)', () => {
    const calls: string[] = [];
    assertExits(() => handleUncaught(recordingRenderer(calls), eexit(130)), 130);
    assert.deepEqual(calls, ['interrupt']);
  });

  it('passes a non-130 oclif exit code through without touching the renderer', () => {
    const calls: string[] = [];
    assertExits(() => handleUncaught(recordingRenderer(calls), eexit(2)), 2);
    assert.deepEqual(calls, []);
  });

  it('defaults to exit code 1 when EEXIT carries no oclif exit code', () => {
    assertExits(() => handleUncaught(recordingRenderer(), eexit()), 1);
  });

  it('reports through flowFailed and exits 1 for non-EEXIT errors', () => {
    const calls: string[] = [];
    assertExits(() => handleUncaught(recordingRenderer(calls), new Error('unexpected crash')), 1);
    assert.deepEqual(calls, ['flowFailed']);
  });

  it('suppresses stdout and stderr before interrupt on Ctrl+C', () => {
    const written: string[] = [];
    const record = ((chunk: unknown): boolean => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stdout.write = record;
    process.stderr.write = record;

    // The renderer's interrupt tries to write; the handler must already have
    // swapped both streams to no-ops, so nothing reaches our recorder.
    const renderer = {
      activeStep: null,
      interrupt() {
        process.stdout.write('to stdout');
        process.stderr.write('to stderr');
      },
    } as unknown as FlowRenderer;

    assertExits(() => handleUncaught(renderer, eexit(130)), 130);
    assert.deepEqual(written, []);
  });
});
