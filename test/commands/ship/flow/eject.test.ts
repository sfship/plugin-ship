/* eslint-disable class-methods-use-this */
import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let builtinSourceResult: string | null = '/builtins/deploy.yml';
let destExists = false;
let mkdirCalled = false;
let copyArgs: [string, string] | undefined;

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
    copyFileSync: (src: string, dest: string) => {
      copyArgs = [src, dest];
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
    copyArgs = undefined;
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

  it('copies the built-in file to the ship flows directory', async () => {
    await FlowEject.run(['deploy']);
    assert.ok(copyArgs, 'copyFileSync called');
    assert.equal(copyArgs[0], '/builtins/deploy.yml');
    assert.ok(copyArgs[1].includes('flows'), 'dest is inside flows/');
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
