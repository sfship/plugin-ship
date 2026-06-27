/* eslint-disable class-methods-use-this */
import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let flowNames: string[] = [];

const FlowList = await mockCommand('ship/flow/list.js', {
  'config.loader.js': {
    loadConfig: () => ({}),
    resolveProjectPaths: () => ({ shipDir: '/proj/.ship' }),
  },
  'flow.registry.js': {
    FlowRegistry: class {
      public list() {
        return flowNames;
      }
    },
  },
  'tree.js': {
    renderTree: (names: string[]) => names.join('\n'),
  },
});

describe('ship flow list', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    flowNames = [];
  });

  it('shows the Flow List header', async () => {
    await FlowList.run([]);
    assert.ok(stubs.styledHeader.calledWith('Flow List'));
  });

  it('logs "No flows available." when the registry is empty', async () => {
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('No flows available.')));
  });

  it('renders flow names via renderTree when flows exist', async () => {
    flowNames = ['deploy', 'release'];
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('deploy')));
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('release')));
  });

  it('logs the info tip when flows exist', async () => {
    flowNames = ['deploy'];
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('sf ship flow info')));
  });
});
