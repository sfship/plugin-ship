import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';

const permsets = await mockTask('org/assign/permsets.js', {
  'stdout.js': {
    withSuppressedStdout: async (fn: () => Promise<unknown>) => fn(),
  },
});

const configWithPermsets = (names: string[]): ShipConfig => ({
  project: { slug: 'test', package: { name: 'MyPkg', type: 'Managed', testPattern: '*_Test', permsets: names } },
  dir: '.ship',
});

const ok = (names: string[]) => ({ successes: names.map((name) => ({ name })), failures: [] });

describe('org/assign/permsets', () => {
  it('assigns permsets from comma-separated param', async () => {
    const { commands } = await runTask(permsets, {
      params: { permsets: 'PermA,PermB' },
      runCommand: async () => ok(['PermA', 'PermB']),
    });
    assert.equal(commands[0]?.id, 'org:assign:permset');
    assert.ok(commands[0]?.argv.includes('PermA'));
    assert.ok(commands[0]?.argv.includes('PermB'));
  });

  it('falls back to config permsets when no param', async () => {
    const { commands } = await runTask(permsets, {
      context: { config: configWithPermsets(['PermC']) },
      runCommand: async () => ok(['PermC']),
    });
    assert.ok(commands[0]?.argv.includes('PermC'));
  });

  it('skips with log when no permsets configured', async () => {
    const { commands, logs } = await runTask(permsets, {});
    assert.equal(commands.length, 0);
    assert.ok(logs[0]?.includes('skipping'));
  });

  it('passes target-org to argv', async () => {
    const { commands } = await runTask(permsets, {
      params: { permsets: 'PermA', 'target-org': 'my-sandbox' },
      runCommand: async () => ok(['PermA']),
    });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });

  it('passes username as --on-behalf-of', async () => {
    const { commands } = await runTask(permsets, {
      params: { permsets: 'PermA', username: 'user@example.com' },
      runCommand: async () => ok(['PermA']),
    });
    assert.ok(commands[0]?.argv.includes('--on-behalf-of'));
    assert.ok(commands[0]?.argv.includes('user@example.com'));
  });

  it('throws ExpectedError on real failures', async () => {
    await assert.rejects(
      () =>
        runTask(permsets, {
          params: { permsets: 'BadPerm' },
          runCommand: async () => ({ successes: [], failures: [{ name: 'BadPerm', message: 'Not found' }] }),
        }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('BadPerm')
    );
  });

  it('ignores duplicate assignment failures', async () => {
    const { logs } = await runTask(permsets, {
      params: { permsets: 'PermA' },
      runCommand: async () => ({
        successes: [],
        failures: [{ name: 'PermA', message: 'Duplicate PermissionSetAssignment found' }],
      }),
    });
    assert.ok(logs[0]?.includes('1'));
  });

  it('logs the count assigned', async () => {
    const { logs } = await runTask(permsets, {
      params: { permsets: 'PermA,PermB' },
      runCommand: async () => ok(['PermA', 'PermB']),
    });
    assert.ok(logs[0]?.includes('2'));
  });
});
