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
import { join } from 'node:path';
import esmock from 'esmock';
import type { initProject as InitProjectFn, InitOptions } from '../../src/core/project.init.js';

type Module = { initProject: typeof InitProjectFn };

const existingPaths = new Set<string>();
const written = new Map<string, string>();
const appended = new Map<string, string>();
const writtenJson = new Map<string, unknown>();
const readTextStubs = new Map<string, string>();
const removedPaths: string[] = [];

const { initProject }: Module = await esmock('../../src/core/project.init.js', {
  '../../src/core/file.js': {
    fileExists: (path: string) => existingPaths.has(path),
    ensureDir: () => {},
    readText: (path: string) => readTextStubs.get(path) ?? '',
    writeText: (path: string, content: string) => {
      written.set(path, content);
    },
    appendText: (path: string, content: string) => {
      appended.set(path, (appended.get(path) ?? '') + content);
    },
    writeJson: (path: string, data: unknown) => {
      writtenJson.set(path, data);
    },
    removeDir: (path: string) => {
      removedPaths.push(path);
    },
  },
});

const DIR = '/proj';
const base: InitOptions = { packageName: 'MyPkg', packageType: 'Managed' };

beforeEach(() => {
  existingPaths.clear();
  written.clear();
  appended.clear();
  writtenJson.clear();
  readTextStubs.clear();
  removedPaths.length = 0;
});

describe('initProject', () => {
  describe('result tracking', () => {
    it('reports all files as created when the project dir is empty', () => {
      const { created, skipped } = initProject(base, DIR);
      assert.ok(created.includes('README.md'));
      assert.ok(created.includes('ship.yml'));
      assert.ok(created.includes('.ship/orgs/dev.json'));
      assert.equal(skipped.length, 0);
    });

    it('reports README.md as skipped when one already existed before generate', () => {
      const { created, skipped } = initProject(base, DIR, true);
      assert.ok(skipped.includes('README.md'));
      assert.equal(created.includes('README.md'), false);
    });

    it('reports ship.yml as skipped when it already exists', () => {
      existingPaths.add(join(DIR, 'ship.yml'));
      const { created, skipped } = initProject(base, DIR);
      assert.ok(skipped.includes('ship.yml'));
      assert.equal(created.includes('ship.yml'), false);
    });

    it('reports an org def as skipped when it already exists', () => {
      existingPaths.add(join(DIR, '.ship', 'orgs', 'dev.json'));
      const { skipped } = initProject(base, DIR);
      assert.ok(skipped.includes('.ship/orgs/dev.json'));
    });
  });

  describe('ship.yml', () => {
    it('includes packageName and packageType', () => {
      initProject(base, DIR);
      const content = written.get(join(DIR, 'ship.yml')) ?? '';
      assert.ok(content.includes('name: MyPkg'));
      assert.ok(content.includes('type: Managed'));
    });

    it('includes namespace when provided', () => {
      initProject({ ...base, namespace: 'mynamespace' }, DIR);
      const content = written.get(join(DIR, 'ship.yml')) ?? '';
      assert.ok(content.includes('namespace: mynamespace'));
    });

    it('omits namespace when not provided', () => {
      initProject(base, DIR);
      assert.equal(written.get(join(DIR, 'ship.yml'))?.includes('namespace'), false);
    });

    it('includes repoUrl when provided', () => {
      initProject({ ...base, repoUrl: 'https://github.com/org/repo' }, DIR);
      const content = written.get(join(DIR, 'ship.yml')) ?? '';
      assert.ok(content.includes('repoUrl: https://github.com/org/repo'));
    });

    it('omits repoUrl when not provided', () => {
      initProject(base, DIR);
      assert.equal(written.get(join(DIR, 'ship.yml'))?.includes('repoUrl'), false);
    });
  });

  describe('sfdx-project.json patching', () => {
    const sfdxPath = join(DIR, 'sfdx-project.json');

    beforeEach(() => {
      existingPaths.add(sfdxPath);
      readTextStubs.set(sfdxPath, JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }] }));
    });

    it('sets package name and versionNumber on the default directory', () => {
      initProject(base, DIR);
      const patched = writtenJson.get(sfdxPath) as { packageDirectories: Array<Record<string, unknown>> };
      assert.equal(patched.packageDirectories[0].package, 'MyPkg');
      assert.equal(patched.packageDirectories[0].versionNumber, '0.0.0.NEXT');
    });

    it('adds ancestorVersion for Managed packages', () => {
      initProject(base, DIR);
      const patched = writtenJson.get(sfdxPath) as { packageDirectories: Array<Record<string, unknown>> };
      assert.equal(patched.packageDirectories[0].ancestorVersion, 'HIGHEST');
    });

    it('omits ancestorVersion for Unlocked packages', () => {
      initProject({ ...base, packageType: 'Unlocked' }, DIR);
      const patched = writtenJson.get(sfdxPath) as { packageDirectories: Array<Record<string, unknown>> };
      assert.equal(patched.packageDirectories[0].ancestorVersion, undefined);
    });

    it('sets namespace on the project when provided', () => {
      initProject({ ...base, namespace: 'mynamespace' }, DIR);
      const patched = writtenJson.get(sfdxPath) as { namespace?: string };
      assert.equal(patched.namespace, 'mynamespace');
    });

    it('does not patch when sfdx-project.json does not exist', () => {
      existingPaths.delete(sfdxPath);
      initProject(base, DIR);
      assert.equal(writtenJson.has(sfdxPath), false);
    });
  });

  describe('.gitignore', () => {
    it('appends the ship entry when the file does not exist', () => {
      initProject(base, DIR);
      assert.ok(appended.get(join(DIR, '.gitignore'))?.includes('.ship/tmp/'));
    });

    it('appends the ship entry when the file exists without the entry', () => {
      const p = join(DIR, '.gitignore');
      existingPaths.add(p);
      readTextStubs.set(p, 'node_modules/\n');
      initProject(base, DIR);
      assert.ok(appended.get(p)?.includes('.ship/tmp/'));
    });

    it('does not append when the entry is already present', () => {
      const p = join(DIR, '.gitignore');
      existingPaths.add(p);
      readTextStubs.set(p, '# sf-ship\n.ship/tmp/\n');
      initProject(base, DIR);
      assert.equal(appended.has(p), false);
    });
  });

  describe('.forceignore', () => {
    it('appends the ship entry when the file does not exist', () => {
      initProject(base, DIR);
      assert.ok(appended.get(join(DIR, '.forceignore'))?.includes('# sf-ship'));
    });

    it('does not append when the entry is already present', () => {
      const p = join(DIR, '.forceignore');
      existingPaths.add(p);
      readTextStubs.set(p, '# sf-ship\n**/*.profile-meta.xml\n');
      initProject(base, DIR);
      assert.equal(appended.has(p), false);
    });
  });

  describe('config directory', () => {
    it('removes the generated config directory', () => {
      initProject(base, DIR);
      assert.ok(removedPaths.includes(join(DIR, 'config')));
    });
  });

  describe('org defs', () => {
    it('creates defs for all six environments', () => {
      const { created } = initProject(base, DIR);
      for (const env of ['dev', 'feature', 'beta', 'qa', 'regression', 'release']) {
        assert.ok(created.includes(`.ship/orgs/${env}.json`), `expected ${env}.json in created`);
      }
    });

    it('uses packageName:env as the orgName', () => {
      initProject(base, DIR);
      const raw = written.get(join(DIR, '.ship', 'orgs', 'dev.json')) ?? '{}';
      const dev = JSON.parse(raw) as { orgName: string };
      assert.equal(dev.orgName, 'MyPkg:dev');
    });
  });
});
