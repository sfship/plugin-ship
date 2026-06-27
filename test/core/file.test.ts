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
import { normalizePath } from '../../src/core/file.js';
import type {
  walkFiles as WalkFilesFn,
  findFiles as FindFilesFn,
  pathExists as PathExistsFn,
} from '../../src/core/file.js';

describe('normalizePath', () => {
  it('lowercases the name', () => {
    assert.equal(normalizePath('CI/Deploy'), 'ci/deploy');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizePath('  ci/deploy  '), 'ci/deploy');
  });

  it('converts backslashes to forward slashes', () => {
    assert.equal(normalizePath('ci\\deploy'), 'ci/deploy');
  });

  it('strips a leading slash', () => {
    assert.equal(normalizePath('/ci/deploy'), 'ci/deploy');
  });

  it('handles a plain name with no separators', () => {
    assert.equal(normalizePath('Deploy'), 'deploy');
  });
});

// — pathExists —

let existsSyncStub: () => boolean = () => false;
let statSyncStub: (() => { isFile: () => boolean; isDirectory: () => boolean }) | null = null;
let statSyncError: (Error & { code?: string }) | null = null;

const { pathExists }: { pathExists: typeof PathExistsFn } = await esmock('../../src/core/file.js', {
  'node:fs': {
    existsSync: () => existsSyncStub(),
    statSync: () => {
      if (statSyncError) throw statSyncError;
      return statSyncStub?.();
    },
  },
});

beforeEach(() => {
  existsSyncStub = () => false;
  statSyncStub = null;
  statSyncError = null;
});

describe('pathExists', () => {
  it('returns true for kind=any when the path exists', () => {
    existsSyncStub = () => true;
    assert.equal(pathExists('/some/path', 'any'), true);
  });

  it('returns false for kind=any when the path does not exist', () => {
    existsSyncStub = () => false;
    assert.equal(pathExists('/some/path', 'any'), false);
  });

  it('returns true for kind=file when stat reports a file', () => {
    statSyncStub = () => ({ isFile: () => true, isDirectory: () => false });
    assert.equal(pathExists('/some/file', 'file'), true);
  });

  it('returns false for kind=file when stat reports a directory', () => {
    statSyncStub = () => ({ isFile: () => false, isDirectory: () => true });
    assert.equal(pathExists('/some/dir', 'file'), false);
  });

  it('returns true for kind=dir when stat reports a directory', () => {
    statSyncStub = () => ({ isFile: () => false, isDirectory: () => true });
    assert.equal(pathExists('/some/dir', 'dir'), true);
  });

  it('returns false for kind=dir when stat reports a file', () => {
    statSyncStub = () => ({ isFile: () => true, isDirectory: () => false });
    assert.equal(pathExists('/some/file', 'dir'), false);
  });

  it('returns false for kind=file when stat throws ENOENT', () => {
    statSyncError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    assert.equal(pathExists('/missing', 'file'), false);
  });

  it('rethrows non-ENOENT errors from stat', () => {
    statSyncError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    assert.throws(() => pathExists('/forbidden', 'file'), /EPERM/);
  });
});

// — walkFiles / findFiles —

type Dirent = { name: string; isDirectory: () => boolean; isFile: () => boolean };
const fsEntries = new Map<string, Dirent[]>();

function file(name: string): Dirent {
  return { name, isDirectory: () => false, isFile: () => true };
}
function dir(name: string): Dirent {
  return { name, isDirectory: () => true, isFile: () => false };
}

const { walkFiles, findFiles }: { walkFiles: typeof WalkFilesFn; findFiles: typeof FindFilesFn } = await esmock(
  '../../src/core/file.js',
  {
    'node:fs/promises': {
      readdir: async (p: string) => fsEntries.get(p) ?? [],
    },
  }
);

beforeEach(() => fsEntries.clear());

describe('walkFiles', () => {
  it('returns all files in a flat directory', async () => {
    fsEntries.set('/root', [file('a.txt'), file('b.txt')]);
    const result = await walkFiles('/root');
    assert.deepEqual(result.sort(), [join('/root', 'a.txt'), join('/root', 'b.txt')]);
  });

  it('recursively returns files from nested directories', async () => {
    fsEntries.set('/root', [file('a.txt'), dir('sub')]);
    fsEntries.set(join('/root', 'sub'), [file('b.txt')]);
    const result = await walkFiles('/root');
    assert.deepEqual(result.sort(), [join('/root', 'a.txt'), join('/root', 'sub', 'b.txt')]);
  });

  it('returns an empty array for an empty directory', async () => {
    fsEntries.set('/root', []);
    const result = await walkFiles('/root');
    assert.deepEqual(result, []);
  });
});

describe('findFiles', () => {
  it('returns all files when pattern is omitted', async () => {
    fsEntries.set('/root', [file('foo.ts'), file('bar.ts')]);
    const result = await findFiles('/root');
    assert.deepEqual(result.sort(), ['bar', 'foo']);
  });

  it('filters files by glob pattern', async () => {
    fsEntries.set('/root', [file('deploy.ts'), file('build.ts'), file('readme.md')]);
    const result = await findFiles('/root', { pattern: 'dep*' });
    assert.deepEqual(result, ['deploy']);
  });

  it('matches case-insensitively', async () => {
    fsEntries.set('/root', [file('Deploy.ts')]);
    const result = await findFiles('/root', { pattern: 'deploy' });
    assert.deepEqual(result, ['Deploy']);
  });

  it('recurses into subdirectories by default', async () => {
    fsEntries.set('/root', [file('a.ts'), dir('sub')]);
    fsEntries.set(join('/root', 'sub'), [file('b.ts')]);
    const result = await findFiles('/root');
    assert.deepEqual(result.sort(), ['a', 'b']);
  });

  it('does not recurse when recursive is false', async () => {
    fsEntries.set('/root', [file('a.ts'), dir('sub')]);
    fsEntries.set(join('/root', 'sub'), [file('b.ts')]);
    const result = await findFiles('/root', { recursive: false });
    assert.deepEqual(result, ['a']);
  });

  it('preserves extensions when stripExtension is false', async () => {
    fsEntries.set('/root', [file('deploy.ts')]);
    const result = await findFiles('/root', { stripExtension: false });
    assert.deepEqual(result, ['deploy.ts']);
  });

  it('returns an empty array when no files match', async () => {
    fsEntries.set('/root', []);
    const result = await findFiles('/nonexistent');
    assert.deepEqual(result, []);
  });

  it('returns an empty array when readdir throws (directory does not exist)', async () => {
    const { findFiles: findFilesThrows }: { findFiles: typeof FindFilesFn } = await esmock('../../src/core/file.js', {
      'node:fs/promises': {
        readdir: async () => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        },
      },
    });
    const result = await findFilesThrows('/nonexistent');
    assert.deepEqual(result, []);
  });

  it('matches single-character wildcard with ?', async () => {
    fsEntries.set('/root', [file('a.ts'), file('ab.ts')]);
    const result = await findFiles('/root', { pattern: '?' });
    assert.deepEqual(result, ['a']);
  });
});
