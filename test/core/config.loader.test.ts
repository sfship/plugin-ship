import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import esmock from 'esmock';
import dedent from 'dedent';
import type { loadConfig as LoadConfigFn, getShipDir as GetShipDirFn } from '@plugin-ship/core/config.loader.js';

type ConfigLoader = { loadConfig: typeof LoadConfigFn; getShipDir: typeof GetShipDirFn };

async function setup(yaml: string): Promise<ConfigLoader> {
  return esmock('../../src/core/config.loader.js', {}, { 'node:fs': { readFileSync: () => yaml } });
}

describe('loadConfig', () => {
  it('parses a minimal valid ship.yml', async () => {
    const { loadConfig } = await setup(dedent`
      project:
        name: my-project
    `);
    assert.equal(loadConfig('ship.yml').project.name, 'my-project');
  });

  it('parses optional dir field', async () => {
    const { loadConfig } = await setup(dedent`
      project:
        name: my-project
      dir: .custom
    `);
    assert.equal(loadConfig('ship.yml').dir, '.custom');
  });

  it('parses flows and steps', async () => {
    const { loadConfig } = await setup(dedent`
      project:
        name: my-project
      flows:
        deploy:
          steps:
            run-tests:
              task: util/log
    `);
    assert.equal(loadConfig('ship.yml').flows?.deploy.steps['run-tests'].task, 'util/log');
  });

  it('throws when the file cannot be read', async () => {
    const { loadConfig }: ConfigLoader = await esmock(
      '../../src/core/config.loader.js',
      {},
      {
        'node:fs': {
          readFileSync: () => {
            throw new Error('ENOENT');
          },
        },
      }
    );
    assert.throws(() => loadConfig('missing.yml'), /No ship\.yml found at missing\.yml/);
  });

  it('throws when the YAML is missing required fields', async () => {
    const { loadConfig } = await setup(dedent`
      dir: .ship
    `);
    assert.throws(() => loadConfig('ship.yml'), /Invalid ship\.yml/);
  });
});

describe('getShipDir', () => {
  it('returns <cwd>/.ship when dir is not set', async () => {
    const { loadConfig, getShipDir } = await setup(dedent`
      project:
        name: p
    `);
    assert.equal(getShipDir('/project', loadConfig('ship.yml')), resolve('/project', '.ship'));
  });

  it('returns <cwd>/<dir> when dir is set', async () => {
    const { loadConfig, getShipDir } = await setup(dedent`
      project:
        name: p
      dir: .custom
    `);
    assert.equal(getShipDir('/project', loadConfig('ship.yml')), resolve('/project', '.custom'));
  });

  it('resolves dir relative to the config directory when config is in a subdirectory', async () => {
    const { loadConfig, getShipDir } = await setup(dedent`
      project:
        name: p
      dir: ../bar
    `);
    // Config lives at /project/foo/foo.yml, so cwd passed is /project/foo
    // dir: ../bar => /project/bar
    assert.equal(getShipDir('/project/foo', loadConfig('foo.yml')), resolve('/project/bar'));
  });
});
