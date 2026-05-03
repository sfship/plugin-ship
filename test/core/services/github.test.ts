import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import type {
  getGithubToken as GetTokenFn,
  setGithubToken as SetTokenFn,
  getGithubMeta as GetMetaFn,
} from '@plugin-ship/core/services/github.js';

type GithubService = {
  getGithubToken: typeof GetTokenFn;
  setGithubToken: typeof SetTokenFn;
  getGithubMeta: typeof GetMetaFn;
};

let getTokenStub: (service: string, alias: string) => string | null = () => null;
let setTokenStub: (...args: unknown[]) => void = () => {};
let getMetaStub: (service: string, alias: string) => unknown = () => undefined;

const { getGithubToken, setGithubToken, getGithubMeta }: GithubService = await esmock(
  '../../../src/core/services/github.js',
  {
    '../../../src/core/service.js': {
      getToken: (service: string, alias: string) => getTokenStub(service, alias),
      setToken: (...args: unknown[]) => setTokenStub(...args),
      getMeta: (service: string, alias: string) => getMetaStub(service, alias),
    },
  }
);

describe('getGithubToken', () => {
  it('returns the stored token', () => {
    getTokenStub = () => 'ghp_abc123';
    assert.equal(getGithubToken(), 'ghp_abc123');
  });

  it('returns undefined when no token is stored', () => {
    getTokenStub = () => null;
    assert.equal(getGithubToken(), undefined);
  });
});

describe('setGithubToken', () => {
  it('forwards all arguments to setToken', () => {
    const calls: unknown[][] = [];
    setTokenStub = (...args) => calls.push(args);
    setGithubToken('ghp_abc123', 'bdematt', 'default', ['repo']);
    assert.equal(calls.length, 1);
    assert.ok((calls[0] as string[]).includes('ghp_abc123'));
    assert.ok((calls[0] as string[]).includes('bdematt'));
  });
});

describe('getGithubMeta', () => {
  it('returns metadata when present', () => {
    const meta = { service: 'github', account: 'bdematt', alias: 'default', scopes: [] };
    getMetaStub = () => meta;
    assert.deepEqual(getGithubMeta(), meta);
  });

  it('returns undefined when no credential is stored', () => {
    getMetaStub = () => undefined;
    assert.equal(getGithubMeta(), undefined);
  });
});
