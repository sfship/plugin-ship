import { strict as assert } from 'node:assert';
import { join, basename } from 'node:path';
import esmock from 'esmock';
import type {
  getToken as GetTokenFn,
  setToken as SetTokenFn,
  getMeta as GetMetaFn,
  listMetas as ListMetasFn,
  deleteToken as DeleteTokenFn,
} from '../../src/core/service.js';

type ServiceModule = {
  getToken: typeof GetTokenFn;
  setToken: typeof SetTokenFn;
  getMeta: typeof GetMetaFn;
  listMetas: typeof ListMetasFn;
  deleteToken: typeof DeleteTokenFn;
};

const SERVICES_DIR = join('/fake', '.sf', 'plugin-ship', 'services');

function makeFileMock(): {
  files: Map<string, unknown>;
  mock: Record<string, unknown>;
} {
  const files = new Map<string, unknown>();
  const mock = {
    ensureDir: () => {},
    listDir: () => [...files.keys()].map((p) => basename(p)),
    readJson: (path: string) => files.get(path),
    writeJson: (path: string, data: unknown) => files.set(path, data),
    removeFile: (path: string) => {
      if (!files.has(path)) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      files.delete(path);
    },
  };
  return { files, mock };
}

function makeFakeEntry(store: Map<string, string>): new (service: string, account: string) => object {
  return class {
    public constructor(_service: string, private readonly account: string) {}
    public getPassword(): string | null {
      return store.get(this.account) ?? null;
    }
    public setPassword(pw: string): void {
      store.set(this.account, pw);
    }
    public deletePassword(): void {
      store.delete(this.account);
    }
  };
}

async function setup(): Promise<ServiceModule & { keyring: Map<string, string>; files: Map<string, unknown> }> {
  const keyring = new Map<string, string>();
  const { files, mock: fileMock } = makeFileMock();

  const mod: ServiceModule = await esmock('../../src/core/service.js', {
    '@napi-rs/keyring': { Entry: makeFakeEntry(keyring) },
    '../../src/core/file.js': fileMock,
    'node:os': { homedir: () => '/fake' },
  });

  return { ...mod, keyring, files };
}

describe('getToken', () => {
  it('returns null when no token is stored', async () => {
    const { getToken } = await setup();
    assert.equal(getToken('github.com', 'default'), null);
  });

  it('returns the stored token', async () => {
    const { setToken, getToken } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    assert.equal(getToken('github.com', 'default'), 'ghp_abc');
  });
});

describe('setToken', () => {
  it('writes the token to the keyring', async () => {
    const { setToken, keyring } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    assert.equal(keyring.get('github.com:default'), 'ghp_abc');
  });

  it('writes a metadata file', async () => {
    const { setToken, files } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc', ['repo']);
    const meta = files.get(join(SERVICES_DIR, 'github.com-bdematt-default.meta.json')) as Record<string, unknown>;
    assert.equal(meta.account, 'bdematt');
    assert.equal(meta.alias, 'default');
    assert.deepEqual(meta.scopes, ['repo']);
  });
});

describe('getMeta', () => {
  it('returns undefined when no credential is stored', async () => {
    const { getMeta } = await setup();
    assert.equal(getMeta('github.com', 'default'), undefined);
  });

  it('returns the metadata for a stored credential', async () => {
    const { setToken, getMeta } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    const meta = getMeta('github.com', 'default');
    assert.equal(meta?.service, 'github.com');
    assert.equal(meta?.account, 'bdematt');
  });
});

describe('listMetas', () => {
  it('returns an empty array when no credentials are stored', async () => {
    const { listMetas } = await setup();
    assert.deepEqual(listMetas(), []);
  });

  it('returns all stored credential metadata', async () => {
    const { setToken, listMetas } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    setToken('github.com', 'bdematt', 'work', 'ghp_xyz');
    assert.equal(listMetas().length, 2);
  });
});

describe('deleteToken', () => {
  it('removes the token from the keyring', async () => {
    const { setToken, deleteToken, keyring } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    deleteToken('github.com', 'bdematt', 'default');
    assert.equal(keyring.has('github.com:default'), false);
  });

  it('removes the metadata file', async () => {
    const { setToken, deleteToken, getMeta } = await setup();
    setToken('github.com', 'bdematt', 'default', 'ghp_abc');
    deleteToken('github.com', 'bdematt', 'default');
    assert.equal(getMeta('github.com', 'default'), undefined);
  });

  it('does not throw when the metadata file does not exist', async () => {
    const { deleteToken } = await setup();
    assert.doesNotThrow(() => deleteToken('github.com', 'bdematt', 'default'));
  });

  it('rethrows errors that are not ENOENT', async () => {
    const permError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    const { mock: fileMock } = makeFileMock();
    fileMock.removeFile = () => {
      throw permError;
    };
    const keyring = new Map<string, string>();
    const mod: ServiceModule = await esmock('../../src/core/service.js', {
      '@napi-rs/keyring': { Entry: makeFakeEntry(keyring) },
      '../../src/core/file.js': { ...fileMock },
      'node:os': { homedir: () => '/fake' },
    });
    assert.throws(
      () => mod.deleteToken('github.com', 'bdematt', 'default'),
      (err) => err === permError
    );
  });
});
