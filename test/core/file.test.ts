import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import esmock from 'esmock';
import { normalizePath } from '../../src/core/file.js';
import type { walkFiles as WalkFilesFn } from '../../src/core/file.js';

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

type Dirent = { name: string; isDirectory: () => boolean };
const fsEntries = new Map<string, Dirent[]>();

function file(name: string): Dirent {
  return { name, isDirectory: () => false };
}
function dir(name: string): Dirent {
  return { name, isDirectory: () => true };
}

const { walkFiles }: { walkFiles: typeof WalkFilesFn } = await esmock('../../src/core/file.js', {
  'node:fs/promises': {
    readdir: async (p: string) => fsEntries.get(p) ?? [],
  },
});

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
