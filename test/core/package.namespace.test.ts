import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { buildTokenMap } from '../../src/core/package.namespace.js';
import type { replaceTokens as ReplaceTokensFn } from '../../src/core/package.namespace.js';

type Module = { replaceTokens: typeof ReplaceTokensFn };

let readFileStub: (path: string) => Promise<Buffer> = async () => Buffer.from('');
let writtenPath: string | undefined;
let writtenContent: string | undefined;

const { replaceTokens }: Module = await esmock('../../src/core/package.namespace.js', {
  'node:fs/promises': {
    readFile: (path: string) => readFileStub(path),
    writeFile: (path: string, content: string) => {
      writtenPath = path;
      writtenContent = content;
    },
  },
});

beforeEach(() => {
  readFileStub = async () => Buffer.from('');
  writtenPath = undefined;
  writtenContent = undefined;
});

describe('buildTokenMap', () => {
  it('builds the correct token map for a namespaced package', () => {
    assert.deepEqual(buildTokenMap('myns'), {
      NAMESPACE: 'myns__',
      NAMESPACE_DOT: 'myns.',
      NAMESPACE_OR_C: 'myns',
    });
  });

  it('builds the correct token map for an unmanaged package', () => {
    assert.deepEqual(buildTokenMap(''), {
      NAMESPACE: '',
      NAMESPACE_DOT: '',
      NAMESPACE_OR_C: 'c',
    });
  });
});

describe('replaceTokens', () => {
  it('replaces a %%%TOKEN%%% placeholder in file content', async () => {
    readFileStub = async () => Buffer.from('Hello %%%NAMESPACE%%%World');
    await replaceTokens('/some/file.txt', buildTokenMap('myns'));
    assert.equal(writtenContent, 'Hello myns__World');
  });

  it('replaces multiple distinct tokens', async () => {
    readFileStub = async () => Buffer.from('%%%NAMESPACE%%%x%%%NAMESPACE_DOT%%%y%%%NAMESPACE_OR_C%%%');
    await replaceTokens('/some/file.txt', buildTokenMap('myns'));
    assert.equal(writtenContent, 'myns__xmyns.ymyns');
  });

  it('writes back to the same file path', async () => {
    readFileStub = async () => Buffer.from('content');
    await replaceTokens('/path/to/file.xml', {});
    assert.equal(writtenPath, '/path/to/file.xml');
  });

  it('skips binary files without writing', async () => {
    readFileStub = async () => Buffer.from([72, 101, 0, 108, 108, 111]); // contains null byte
    await replaceTokens('/some/binary.bin', { NAMESPACE: 'myns__' });
    assert.equal(writtenContent, undefined);
  });
});
