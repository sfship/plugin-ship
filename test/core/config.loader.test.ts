import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import dedent from 'dedent';
import type { loadConfig as LoadConfigFn } from '../../src/core/config.loader.js';

type ConfigLoader = { loadConfig: typeof LoadConfigFn };

let readTextStub: (path: string) => string = () => '';

const { loadConfig }: ConfigLoader = await esmock('../../src/core/config.loader.js', {
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
        slug: my-project
    `;
    assert.equal(loadConfig('ship.yml').project.slug, 'my-project');
  });

  it('parses optional dir field', () => {
    readTextStub = () => dedent`
      project:
        slug: my-project
      dir: .custom
    `;
    assert.equal(loadConfig('ship.yml').dir, '.custom');
  });

  it('throws when the file cannot be read', () => {
    readTextStub = () => {
      throw new Error('ENOENT');
    };
    assert.throws(() => loadConfig('missing.yml'), /No ship\.yml found at missing\.yml/);
  });

  it('throws when the YAML is unparseable', () => {
    readTextStub = () => 'key: [unclosed';
    assert.throws(() => loadConfig('ship.yml'), /Could not parse ship\.yml/);
  });

  it('throws when the YAML is missing required fields', () => {
    readTextStub = () => dedent`
      dir: .ship
    `;
    assert.throws(() => loadConfig('ship.yml'), /Invalid ship\.yml/);
  });
});
