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
/* eslint-disable camelcase */

import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import { normalizeRepo } from '../../src/core/service.github.js';
import type {
  getGithubToken as GetTokenFn,
  setGithubToken as SetTokenFn,
  fetchRelease as FetchReleaseFn,
  fetchRaw as FetchRawFn,
  downloadDir as DownloadDirFn,
  requestDeviceCode as RequestDeviceCodeFn,
  pollForToken as PollForTokenFn,
  fetchGitTag as FetchGitTagFn,
  fetchCciNamespace as FetchCciNamespaceFn,
  fetchSubdirs as FetchSubdirsFn,
  gh as GhFn,
  fetchFirstCommitSha as FetchFirstCommitShaFn,
  resolveCommitSha as ResolveCommitShaFn,
  fetchGithubUser as FetchGithubUserFn,
} from '../../src/core/service.github.js';

type GithubService = {
  getGithubToken: typeof GetTokenFn;
  setGithubToken: typeof SetTokenFn;
  fetchRelease: typeof FetchReleaseFn;
  fetchRaw: typeof FetchRawFn;
  downloadDir: typeof DownloadDirFn;
  requestDeviceCode: typeof RequestDeviceCodeFn;
  pollForToken: typeof PollForTokenFn;
  fetchGitTag: typeof FetchGitTagFn;
  fetchCciNamespace: typeof FetchCciNamespaceFn;
  fetchSubdirs: typeof FetchSubdirsFn;
  gh: typeof GhFn;
  fetchFirstCommitSha: typeof FetchFirstCommitShaFn;
  resolveCommitSha: typeof ResolveCommitShaFn;
  fetchGithubUser: typeof FetchGithubUserFn;
};

let getTokenStub: (service: string, alias: string) => string | null = () => null;
let setTokenStub: (...args: unknown[]) => void = () => {};

const written = new Map<string, Buffer>();
let mkdirCalled = false;

const {
  getGithubToken,
  setGithubToken,
  fetchRelease,
  fetchRaw,
  downloadDir,
  requestDeviceCode,
  pollForToken,
  fetchGitTag,
  fetchCciNamespace,
  fetchSubdirs,
  gh,
  fetchFirstCommitSha,
  resolveCommitSha,
  fetchGithubUser,
}: GithubService = await esmock('../../src/core/service.github.js', {
  '../../src/core/service.js': {
    getToken: (service: string, alias: string) => getTokenStub(service, alias),
    setToken: (...args: unknown[]) => setTokenStub(...args),
  },
  '../../src/core/file.js': {
    ensureDir: () => {
      mkdirCalled = true;
    },
    writeBinary: (path: string, data: Buffer) => {
      written.set(path, data);
    },
  },
});

beforeEach(() => {
  written.clear();
  mkdirCalled = false;
  getTokenStub = () => null;
  setTokenStub = () => {};
});

// ---- normalizeRepo ----------------------------------------------------------

describe('normalizeRepo', () => {
  it('passes through an owner/repo slug', () => {
    assert.equal(normalizeRepo('owner/repo'), 'owner/repo');
  });

  it('strips https://github.com/ prefix', () => {
    assert.equal(normalizeRepo('https://github.com/owner/repo'), 'owner/repo');
  });

  it('strips .git suffix', () => {
    assert.equal(normalizeRepo('owner/repo.git'), 'owner/repo');
  });
});

// ---- getGithubToken / setGithubToken ----------------------------------------

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

// ---- fetchRelease -----------------------------------------------------------

describe('fetchRelease', () => {
  it('returns the latest release', async () => {
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ tag_name: 'v1.0.0' }) } as Response);
    assert.deepEqual(await fetchRelease('owner/repo'), { tagName: 'v1.0.0' });
  });

  it('returns null on 404', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.equal(await fetchRelease('owner/repo'), null);
  });

  it('throws on a non-404 error', async () => {
    global.fetch = async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' } as Response);
    await assert.rejects(() => fetchRelease('owner/repo'), /Internal Server Error/);
  });

  it('returns the latest prerelease', async () => {
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [
          { tag_name: 'v1.0.0', prerelease: false },
          { tag_name: 'v1.1.0-beta', prerelease: true },
        ],
      } as Response);
    assert.deepEqual(await fetchRelease('owner/repo', undefined, true), { tagName: 'v1.1.0-beta' });
  });

  it('returns a specific release by tag', async () => {
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ tag_name: 'v1.0.0' }) } as Response);
    assert.deepEqual(await fetchRelease('owner/repo', 'v1.0.0'), { tagName: 'v1.0.0' });
  });

  it('returns null when no prerelease exists in the listing', async () => {
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [{ tag_name: 'v1.0.0', prerelease: false }],
      } as Response);
    assert.equal(await fetchRelease('owner/repo', undefined, true), null);
  });
});

// ---- fetchRaw ---------------------------------------------------------------

describe('fetchRaw', () => {
  it('returns the file text on success', async () => {
    global.fetch = async () => ({ ok: true, status: 200, text: async () => 'file contents' } as Response);
    assert.equal(await fetchRaw('owner/repo', 'main', 'file.txt'), 'file contents');
  });

  it('returns null on 404', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.equal(await fetchRaw('owner/repo', 'main', 'missing.txt'), null);
  });

  it('throws on a non-404 error', async () => {
    global.fetch = async () => ({ ok: false, status: 500, statusText: 'Server Error' } as Response);
    await assert.rejects(() => fetchRaw('owner/repo', 'main', 'file.txt'), /Server Error/);
  });
});

// ---- downloadDir ------------------------------------------------------------

describe('downloadDir', () => {
  it('writes a base64-encoded file to localDir', async () => {
    getTokenStub = () => 'ghp_test';
    const content = Buffer.from('hello').toString('base64');
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [{ name: 'test.xml', path: 'src/test.xml', type: 'file', content, encoding: 'base64' }],
      } as Response);

    await downloadDir('org/repo', 'v1', 'src', '/local');
    assert.ok(mkdirCalled);
    const buf = [...written.values()][0];
    assert.equal(buf?.toString(), 'hello');
  });

  it('fetches and writes a file via download_url', async () => {
    getTokenStub = () => null;
    const fileContent = Buffer.from('world');
    global.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/contents/'))
        return {
          ok: true,
          status: 200,
          json: async () => [
            { name: 'data.xml', path: 'src/data.xml', type: 'file', download_url: 'https://raw.example.com/data.xml' },
          ],
        } as Response;
      return { ok: true, status: 200, arrayBuffer: async () => fileContent.buffer } as Response;
    };

    await downloadDir('org/repo', 'v1', 'src', '/local');
    assert.equal(written.size, 1);
  });

  it('throws when a file has no content or download_url', async () => {
    getTokenStub = () => null;
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [{ name: 'bad.xml', path: 'src/bad.xml', type: 'file' }],
      } as Response);

    await assert.rejects(() => downloadDir('org/repo', 'v1', 'src', '/local'), /no content or download_url/);
  });

  it('recurses into subdirectory entries', async () => {
    getTokenStub = () => null;
    const content = Buffer.from('nested').toString('base64');
    let callCount = 0;
    global.fetch = async (input: string | URL | Request) => {
      callCount++;
      const url = String(input);
      const isNested = url.includes('/contents/src/sub');
      return {
        ok: true,
        status: 200,
        json: async () =>
          isNested
            ? [{ name: 'file.xml', path: 'src/sub/file.xml', type: 'file', content, encoding: 'base64' }]
            : [{ name: 'sub', path: 'src/sub', type: 'dir' }],
      } as Response;
    };

    await downloadDir('org/repo', 'v1', 'src', '/local');
    assert.equal(callCount, 2);
    assert.equal(written.size, 1);
  });

  it('throws when the directory listing fetch fails', async () => {
    getTokenStub = () => null;
    global.fetch = async () =>
      ({ ok: false, status: 403, statusText: 'Forbidden', json: async () => ({}) } as Response);

    await assert.rejects(() => downloadDir('org/repo', 'v1', 'src', '/local'), /Failed to fetch/);
  });
});

// ---- requestDeviceCode ------------------------------------------------------

describe('requestDeviceCode', () => {
  it('returns the device code response from GitHub', async () => {
    const expected = {
      device_code: 'dc_abc',
      user_code: 'XXXX-YYYY',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };
    global.fetch = async () => ({ json: async () => expected } as Response);
    const result = await requestDeviceCode();
    assert.deepEqual(result, expected);
  });
});

// ---- pollForToken -----------------------------------------------------------

describe('pollForToken', () => {
  it('returns the access token when the user authorizes', async () => {
    global.fetch = async () => ({ json: async () => ({ access_token: 'ghp_final' }) } as Response);
    const token = await pollForToken('dc_code', 0);
    assert.equal(token, 'ghp_final');
  });

  it('retries when authorization is pending', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return {
        json: async () => (calls < 2 ? { error: 'authorization_pending' } : { access_token: 'ghp_retry' }),
      } as Response;
    };
    const token = await pollForToken('dc_code', 0);
    assert.equal(token, 'ghp_retry');
    assert.equal(calls, 2);
  });

  it('throws when GitHub returns an authorization error', async () => {
    global.fetch = async () => ({ json: async () => ({ error: 'access_denied' }) } as Response);
    await assert.rejects(() => pollForToken('dc_code', 0), /GitHub authorization failed/);
  });

  it('includes the error code in the message when present', async () => {
    global.fetch = async () => ({ json: async () => ({ error: 'expired_token' }) } as Response);
    await assert.rejects(() => pollForToken('dc_code', 0), /expired_token/);
  });

  it('uses "unknown error" when no error code is present', async () => {
    global.fetch = async () => ({ json: async () => ({}) } as Response);
    await assert.rejects(() => pollForToken('dc_code', 0), /unknown error/);
  });
});

// ---- fetchGitTag ------------------------------------------------------------

describe('fetchGitTag', () => {
  it('returns the tag message for an annotated tag', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      if (calls === 1) return { ok: true, json: async () => ({ object: { type: 'tag', sha: 'abc' } }) } as Response;
      return { ok: true, json: async () => ({ message: 'Release v1.0' }) } as Response;
    };
    assert.deepEqual(await fetchGitTag('org/repo', 'v1.0'), { message: 'Release v1.0' });
  });

  it('returns null when the ref fetch is not ok', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.equal(await fetchGitTag('org/repo', 'v1.0'), null);
  });

  it('returns null for a lightweight tag', async () => {
    global.fetch = async () =>
      ({ ok: true, json: async () => ({ object: { type: 'commit', sha: 'abc' } }) } as Response);
    assert.equal(await fetchGitTag('org/repo', 'v1.0'), null);
  });

  it('returns null when the tag object fetch is not ok', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      if (calls === 1) return { ok: true, json: async () => ({ object: { type: 'tag', sha: 'abc' } }) } as Response;
      return { ok: false, status: 404 } as Response;
    };
    assert.equal(await fetchGitTag('org/repo', 'v1.0'), null);
  });
});

// ---- fetchCciNamespace ------------------------------------------------------

describe('fetchCciNamespace', () => {
  it('returns the namespace from cumulusci.yml', async () => {
    global.fetch = async () =>
      ({ ok: true, status: 200, text: async () => 'project:\n  package:\n    namespace: myns\n' } as Response);
    assert.equal(await fetchCciNamespace('org/repo', 'v1.0'), 'myns');
  });

  it('returns an empty string when cumulusci.yml has no namespace field', async () => {
    global.fetch = async () => ({ ok: true, status: 200, text: async () => 'project:\n  name: myproject' } as Response);
    assert.equal(await fetchCciNamespace('org/repo', 'v1.0'), '');
  });

  it('returns an empty string when the file does not exist', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.equal(await fetchCciNamespace('org/repo', 'v1.0'), '');
  });
});

// ---- fetchSubdirs -----------------------------------------------------------

describe('fetchSubdirs', () => {
  it('returns subdirectory paths', async () => {
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [
          { name: 'v1', type: 'dir' },
          { name: 'v2', type: 'dir' },
          { name: 'README.md', type: 'file' },
        ],
      } as Response);
    assert.deepEqual(await fetchSubdirs('org/repo', 'v1.0', 'releases'), ['releases/v1', 'releases/v2']);
  });

  it('returns an empty array on 404', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.deepEqual(await fetchSubdirs('org/repo', 'v1.0', 'missing'), []);
  });

  it('throws on non-404 errors', async () => {
    global.fetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' } as Response);
    await assert.rejects(() => fetchSubdirs('org/repo', 'v1.0', 'unpackaged/pre'), /Failed to list/);
  });
});

// ---- gh ---------------------------------------------------------------------

describe('gh', () => {
  it('returns parsed JSON on success', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ sha: 'abc123' }) } as Response);
    const result = await gh<{ sha: string }>('ghp_test', '/repos/org/repo/git/tags');
    assert.equal(result.sha, 'abc123');
  });

  it('throws ExpectedError on non-ok response', async () => {
    global.fetch = async () =>
      ({ ok: false, status: 422, statusText: 'Unprocessable', text: async () => 'invalid' } as Response);
    await assert.rejects(() => gh('ghp_test', '/repos/org/repo/git/tags'), /422/);
  });

  it('sends JSON body and Content-Type header', async () => {
    let capturedInit: RequestInit | undefined;
    global.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({}) } as Response;
    };
    await gh('ghp_test', '/repos/org/repo/git/refs', { method: 'POST', body: { ref: 'refs/tags/v1' } });
    assert.ok((capturedInit?.headers as Record<string, string>)['Content-Type']?.includes('application/json'));
    assert.ok(String(capturedInit?.body).includes('refs/tags/v1'));
  });
});

// ---- fetchFirstCommitSha ----------------------------------------------------

describe('fetchFirstCommitSha', () => {
  it('returns the commit SHA when there is only one page', async () => {
    global.fetch = async () =>
      ({
        ok: true,
        headers: { get: () => null },
        json: async () => [{ sha: 'first-sha' }],
      } as unknown as Response);
    assert.equal(await fetchFirstCommitSha('org/repo', 'ghp_test'), 'first-sha');
  });

  it('fetches the last page when a link header is present', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 1)
        return {
          ok: true,
          headers: { get: () => '<https://api.github.com/repos/org/repo/commits?per_page=1&page=42>; rel="last"' },
          json: async () => [{ sha: 'recent-sha' }],
        } as unknown as Response;
      return {
        ok: true,
        headers: { get: () => null },
        json: async () => [{ sha: 'oldest-sha' }],
      } as unknown as Response;
    };
    assert.equal(await fetchFirstCommitSha('org/repo', 'ghp_test'), 'oldest-sha');
    assert.equal(callCount, 2);
  });

  it('returns null when the initial fetch fails', async () => {
    global.fetch = async () => ({ ok: false, status: 404 } as Response);
    assert.equal(await fetchFirstCommitSha('org/repo', 'ghp_test'), null);
  });
});

// ---- fetchGithubUser --------------------------------------------------------

describe('fetchGithubUser', () => {
  it('returns the authenticated user and their scopes', async () => {
    global.fetch = async () =>
      ({
        json: async () => ({ login: 'testuser' }),
        headers: { get: (key: string) => (key === 'x-oauth-scopes' ? 'repo, user' : null) },
      } as unknown as Response);
    const { user, scopes } = await fetchGithubUser('ghp_test');
    assert.equal(user.login, 'testuser');
    assert.deepEqual(scopes, ['repo', 'user']);
  });

  it('returns an empty scopes array when the header is absent', async () => {
    global.fetch = async () =>
      ({
        json: async () => ({ login: 'testuser' }),
        headers: { get: () => null },
      } as unknown as Response);
    const { scopes } = await fetchGithubUser('ghp_test');
    assert.deepEqual(scopes, []);
  });
});

// ---- resolveCommitSha -------------------------------------------------------

describe('resolveCommitSha', () => {
  it('returns a 40-char SHA directly without fetching', async () => {
    const sha = 'a'.repeat(40);
    const result = await resolveCommitSha(sha, 'ghp_test', 'org/repo');
    assert.equal(result, sha);
  });

  it('resolves a branch name to its commit SHA', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ commit: { sha: 'branch-tip-sha' } }) } as Response);
    assert.equal(await resolveCommitSha('main', 'ghp_test', 'org/repo'), 'branch-tip-sha');
  });

  it('looks up the default branch when no target is given', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 1) return { ok: true, json: async () => ({ default_branch: 'main' }) } as Response;
      return { ok: true, json: async () => ({ commit: { sha: 'default-sha' } }) } as Response;
    };
    assert.equal(await resolveCommitSha(undefined, 'ghp_test', 'org/repo'), 'default-sha');
    assert.equal(callCount, 2);
  });
});
