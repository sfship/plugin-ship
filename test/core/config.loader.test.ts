import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import esmock from 'esmock';
import dedent from 'dedent';
import type { loadConfig as LoadConfigFn, getShipDir as GetShipDirFn } from '@plugin-ship/core/config.loader.js';

type ConfigLoader = { loadConfig: typeof LoadConfigFn; getShipDir: typeof GetShipDirFn };

let readTextStub: (path: string) => string = () => '';

const { loadConfig, getShipDir }: ConfigLoader = await esmock('../../src/core/config.loader.js', {
  '../../src/core/file.js': {
    readText: (path: string) => readTextStub(path),
  },
});

beforeEach(() => {
  readTextStub = () => '';
});

describe('loadConfig', () => {
  it('parses a minimal valid ship.yml', () => {
    readTextStub = () => dedent`
      project:
        name: my-project
    `;
    assert.equal(loadConfig('ship.yml').project.name, 'my-project');
  });

  it('parses optional dir field', () => {
    readTextStub = () => dedent`
      project:
        name: my-project
      dir: .custom
    `;
    assert.equal(loadConfig('ship.yml').dir, '.custom');
  });

  it('parses flows and steps', () => {
    readTextStub = () => dedent`
      project:
        name: my-project
      flows:
        deploy:
          steps:
            run-tests:
              task: util/log
    `;
    assert.equal(loadConfig('ship.yml').flows?.deploy.steps['run-tests'].task, 'util/log');
  });

  it('throws when the file cannot be read', () => {
    readTextStub = () => {
      throw new Error('ENOENT');
    };
    assert.throws(() => loadConfig('missing.yml'), /No ship\.yml found at missing\.yml/);
  });

  it('throws when the YAML is missing required fields', () => {
    readTextStub = () => dedent`
      dir: .ship
    `;
    assert.throws(() => loadConfig('ship.yml'), /Invalid ship\.yml/);
  });
});

describe('getShipDir', () => {
  it('returns <cwd>/.ship when dir is not set', () => {
    readTextStub = () => dedent`
      project:
        name: p
    `;
    assert.equal(getShipDir('/project', loadConfig('ship.yml')), resolve('/project', '.ship'));
  });

  it('returns <cwd>/<dir> when dir is set', () => {
    readTextStub = () => dedent`
      project:
        name: p
      dir: .custom
    `;
    assert.equal(getShipDir('/project', loadConfig('ship.yml')), resolve('/project', '.custom'));
  });

  it('resolves dir relative to the config directory when config is in a subdirectory', () => {
    readTextStub = () => dedent`
      project:
        name: p
      dir: ../bar
    `;
    // Config lives at /project/foo/foo.yml, so cwd passed is /project/foo
    // dir: ../bar => /project/bar
    assert.equal(getShipDir('/project/foo', loadConfig('foo.yml')), resolve('/project/bar'));
  });
});
