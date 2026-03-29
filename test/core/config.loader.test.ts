import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import esmock from 'esmock';
import dedent from 'dedent';
import type { load as LoadFn, getShipDir as GetShipDirFn } from '@plugin-ship/core/config.loader.js';

type ConfigLoader = { load: typeof LoadFn; getShipDir: typeof GetShipDirFn };

async function setup(yaml: string): Promise<ConfigLoader> {
  return esmock('../../src/core/config.loader.js', {}, { 'node:fs': { readFileSync: () => yaml } });
}

describe('load', () => {
  it('parses a minimal valid ship.yml', async () => {
    const { load } = await setup(dedent`
      project:
        name: my-project
    `);
    assert.equal(load('ship.yml').project.name, 'my-project');
  });

  it('parses optional dir field', async () => {
    const { load } = await setup(dedent`
      project:
        name: my-project
      dir: .custom
    `);
    assert.equal(load('ship.yml').dir, '.custom');
  });

  it('parses flows and steps', async () => {
    const { load } = await setup(dedent`
      project:
        name: my-project
      flows:
        deploy:
          steps:
            run-tests:
              task: util/log
    `);
    assert.equal(load('ship.yml').flows?.deploy.steps['run-tests'].task, 'util/log');
  });

  it('throws when the file cannot be read', async () => {
    const { load }: ConfigLoader = await esmock(
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
    assert.throws(() => load('missing.yml'), /No ship\.yml found at missing\.yml/);
  });

  it('throws when the YAML is missing required fields', async () => {
    const { load } = await setup(dedent`
      dir: .ship
    `);
    assert.throws(() => load('ship.yml'), /Invalid ship\.yml/);
  });
});

describe('getShipDir', () => {
  it('returns <cwd>/.ship when dir is not set', async () => {
    const { load, getShipDir } = await setup(dedent`
      project:
        name: p
    `);
    assert.equal(getShipDir('/project', load('ship.yml')), resolve('/project', '.ship'));
  });

  it('returns <cwd>/<dir> when dir is set', async () => {
    const { load, getShipDir } = await setup(dedent`
      project:
        name: p
      dir: .custom
    `);
    assert.equal(getShipDir('/project', load('ship.yml')), resolve('/project', '.custom'));
  });
});
