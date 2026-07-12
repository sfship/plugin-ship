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
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let builtinSourceResult: string | null = '/builtins/deploy.yml';
let destExists = false;
let mkdirCalled = false;
let writeArgs: [string, string] | undefined;

const FlowEject = await mockCommand('ship/flow/eject.js', {
  'config.loader.js': {
    loadConfig: () => ({}),
    resolveProjectPaths: () => ({ shipDir: '/proj/.ship' }),
  },
  'flow.registry.js': {
    FlowRegistry: class {
      public builtinSource() {
        return builtinSourceResult;
      }
    },
    builtinsDir: '/builtins',
  },
  'node:fs': {
    existsSync: () => destExists,
    mkdirSync: () => {
      mkdirCalled = true;
    },
    readFileSync: () => 'steps: {}\n',
    writeFileSync: (dest: string, content: string) => {
      writeArgs = [dest, content];
    },
  },
});

describe('ship flow eject', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    builtinSourceResult = '/builtins/deploy.yml';
    destExists = false;
    mkdirCalled = false;
    writeArgs = undefined;
  });

  it('shows the Flow Eject header', async () => {
    await FlowEject.run(['deploy']);
    assert.ok(stubs.styledHeader.calledWith('Flow Eject'));
  });

  it('errors when the flow name is not a built-in', async () => {
    builtinSourceResult = null;
    await assert.rejects(
      () => FlowEject.run(['custom-flow']),
      (err: unknown) => err instanceof Error && err.message.includes('not a built-in flow')
    );
  });

  it('errors when the destination file already exists', async () => {
    destExists = true;
    await assert.rejects(
      () => FlowEject.run(['deploy']),
      (err: unknown) => err instanceof Error && err.message.includes('already exists')
    );
  });

  it('writes the built-in flow to the ship flows directory with a schema modeline', async () => {
    await FlowEject.run(['deploy']);
    assert.ok(writeArgs, 'writeFileSync called');
    assert.ok(writeArgs[0].includes('flows'), 'dest is inside flows/');
    assert.ok(writeArgs[1].startsWith('# yaml-language-server: $schema='));
    assert.ok(writeArgs[1].includes('/lib/schemas/flow.schema.json'));
    assert.ok(writeArgs[1].endsWith('steps: {}\n'), 'original content follows the modeline');
  });

  it('creates the destination directory before copying', async () => {
    await FlowEject.run(['deploy']);
    assert.ok(mkdirCalled);
  });

  it('logs a success message with the destination path', async () => {
    await FlowEject.run(['deploy']);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('Ejected flow to:')));
  });
});
