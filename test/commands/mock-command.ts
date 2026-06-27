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
import esmock from 'esmock';

const load = esmock as (path: string, mocks?: Record<string, unknown>) => Promise<Record<string, unknown>>;

export type MockedCommand = { run(argv: string[]): Promise<void> };

/**
 * Esmocks a command module and returns its default export.
 *
 * - commandPath: relative to src/commands/ (e.g. 'ship/task/info.js')
 * - mocks: keys are npm package names (e.g. '@salesforce/core'), src/core/ module names (e.g. 'config.loader.js'), or bare node: specifiers.
 */
export async function mockCommand(
  commandPath: string,
  mocks: Record<string, Record<string, unknown>> = {}
): Promise<MockedCommand> {
  const resolvedMocks: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mocks)) {
    resolvedMocks[key.startsWith('node:') || key.includes('/') ? key : `../../src/core/${key}`] = value;
  }
  const mod = await load(`../../src/commands/${commandPath}`, resolvedMocks);
  return mod['default'] as MockedCommand;
}
