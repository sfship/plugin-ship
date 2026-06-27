/*
 * Copyright 2026, Salesforce, Inc.
 *
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
import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import apexTest from '../../../../../src/core/tasks/apex/run/test.js';
import { ExpectedError } from '../../../../../src/core/error.js';

const okResult = (
  overrides?: Partial<{ testsRan: number; passing: number; failing: number; orgWideCoverage: string }>
) => ({
  summary: { outcome: 'Passed', testsRan: 5, passing: 5, failing: 0, ...overrides },
});

describe('apex/run/test', () => {
  it('calls apex:run:test', async () => {
    const { commands } = await runTask(apexTest, { runCommand: async () => okResult() });
    assert.equal(commands[0]?.id, 'apex:run:test');
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(apexTest, {
      params: { 'target-org': 'my-sandbox' },
      runCommand: async () => okResult(),
    });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });

  it('defaults to RunLocalTests when no class-names', async () => {
    const { commands } = await runTask(apexTest, { runCommand: async () => okResult() });
    assert.ok(commands[0]?.argv.includes('RunLocalTests'));
  });

  it('uses RunSpecifiedTests when class-names is provided', async () => {
    const { commands } = await runTask(apexTest, {
      params: { 'class-names': 'MyTest' },
      runCommand: async () => okResult(),
    });
    assert.ok(commands[0]?.argv.includes('RunSpecifiedTests'));
  });

  it('prepends namespace to unqualified class names', async () => {
    const { commands } = await runTask(apexTest, {
      params: { 'class-names': 'MyTest,ns.OtherTest', namespace: 'myns' },
      runCommand: async () => okResult(),
    });
    const argv = commands[0]?.argv.join(' ') ?? '';
    assert.ok(argv.includes('myns.MyTest'));
    assert.ok(argv.includes('ns.OtherTest'));
  });

  it('logs test result summary', async () => {
    const { logs } = await runTask(apexTest, { runCommand: async () => okResult() });
    assert.ok(logs.some((l) => l.includes('5')));
  });

  it('throws ExpectedError when summary is missing (timeout)', async () => {
    await assert.rejects(
      () => runTask(apexTest, { runCommand: async () => ({}) }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('wait period')
    );
  });

  it('throws ExpectedError when coverage is below minimum', async () => {
    await assert.rejects(
      () =>
        runTask(apexTest, {
          params: { 'min-coverage': 80 },
          runCommand: async () => okResult({ orgWideCoverage: '72%' }),
        }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('72%')
    );
  });

  it('logs coverage when min-coverage passes', async () => {
    const { logs } = await runTask(apexTest, {
      params: { 'min-coverage': 70 },
      runCommand: async () => okResult({ orgWideCoverage: '85%' }),
    });
    assert.ok(logs.some((l) => l.includes('85%')));
  });
});
