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
import { strict as assert } from 'node:assert';
import { join, resolve, dirname } from 'node:path';
import esmock from 'esmock';
import dedent from 'dedent';
import type { loadConfig as LoadConfigFn } from '../../src/core/config.loader.js';
import { resolveProjectPaths } from '../../src/core/config.loader.js';

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

describe('resolveProjectPaths', () => {
  it('resolves projectDir from the config file path', () => {
    const configPath = '/my/project/ship.yml';
    const { projectDir } = resolveProjectPaths(configPath, { project: { slug: 'test' }, dir: '.ship' });
    assert.equal(projectDir, resolve(dirname(configPath)));
  });

  it('resolves shipDir by joining projectDir with config.dir', () => {
    const configPath = '/my/project/ship.yml';
    const { projectDir, shipDir } = resolveProjectPaths(configPath, { project: { slug: 'test' }, dir: '.ship' });
    assert.equal(shipDir, join(projectDir, '.ship'));
  });
});
