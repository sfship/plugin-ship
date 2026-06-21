import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import esmock from 'esmock';
import { normalizePath } from '../../src/core/file.js';
import type { walkFiles as WalkFilesFn, findFiles as FindFilesFn } from '../../src/core/file.js';

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
