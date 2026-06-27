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
import { resolve, join } from 'node:path';
import esmock from 'esmock';
import {
  readSfdxProject,
  defaultPackageDirectory,
  defaultPackageAlias,
  type SfdxProject,
} from '../../src/core/sfdx-project.js';
import type { writeSfdxProject as WriteFn } from '../../src/core/sfdx-project.js';

const fixtureDir = resolve('test/fixtures');

let readJsonStub: () => unknown = () => ({ packageDirectories: [] });
const { defaultPackageAlias: stubbedDefaultPackageAlias }: { defaultPackageAlias: typeof defaultPackageAlias } =
  await esmock('../../src/core/sfdx-project.js', {
    '../../src/core/file.js': { readJson: () => readJsonStub(), writeJson: () => {} },
  });

describe('readSfdxProject', () => {
  it('reads and parses sfdx-project.json from the project directory', () => {
    const result = readSfdxProject(fixtureDir);
    assert.equal(result.packageDirectories[0].path, 'force-app');
    assert.equal(result.packageAliases?.['MyPkg'], '0Ho000000000000AAA');
  });
});

describe('writeSfdxProject', () => {
  it('writes to <projectDir>/sfdx-project.json', async () => {
    let capturedPath: string | undefined;
    let capturedData: unknown;
    const { writeSfdxProject }: { writeSfdxProject: typeof WriteFn } = await esmock('../../src/core/sfdx-project.js', {
      '../../src/core/file.js': {
        writeJson: (path: string, data: unknown) => {
          capturedPath = path;
          capturedData = data;
        },
      },
    });
    const project: SfdxProject = { packageDirectories: [{ path: 'force-app', default: true }] };
    writeSfdxProject('/my/project', project);
    assert.equal(capturedPath, join('/my/project', 'sfdx-project.json'));
    assert.deepEqual(capturedData, project);
  });
});

describe('defaultPackageDirectory', () => {
  it('returns the directory marked default', () => {
    const p: SfdxProject = { packageDirectories: [{ path: 'other' }, { path: 'main', default: true }] };
    assert.equal(defaultPackageDirectory(p)?.path, 'main');
  });

  it('falls back to the first directory when none is marked default', () => {
    const p: SfdxProject = { packageDirectories: [{ path: 'first' }, { path: 'second' }] };
    assert.equal(defaultPackageDirectory(p)?.path, 'first');
  });

  it('returns undefined when packageDirectories is empty', () => {
    assert.equal(defaultPackageDirectory({ packageDirectories: [] }), undefined);
  });
});

describe('defaultPackageAlias', () => {
  beforeEach(() => {
    readJsonStub = () => ({ packageDirectories: [] });
  });

  it('returns the package alias of the default directory', () => {
    readJsonStub = () => ({ packageDirectories: [{ path: 'force-app', package: 'MyPkg', default: true }] });
    assert.equal(stubbedDefaultPackageAlias('/proj'), 'MyPkg');
  });

  it('returns null when the default directory has no package alias', () => {
    readJsonStub = () => ({ packageDirectories: [{ path: 'force-app' }] });
    assert.equal(stubbedDefaultPackageAlias('/proj'), null);
  });

  it('returns null when the file cannot be read', () => {
    readJsonStub = () => {
      throw new Error('ENOENT');
    };
    assert.equal(stubbedDefaultPackageAlias('/proj'), null);
  });
});
