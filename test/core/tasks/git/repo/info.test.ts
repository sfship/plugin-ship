/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';
import type { GithubRepo } from '../../../../../src/core/service.github.js';

let tokenValue: string | undefined = 'ghp_test';
let capturedRepo = '';
let fetchRepoResult: GithubRepo | Error = {
  full_name: 'acme/my-repo',
  description: 'A repo',
  default_branch: 'main',
  stargazers_count: 42,
  open_issues_count: 3,
  visibility: 'public',
};

const info = await mockTask('git/repo/info.js', {
  'service.github.js': {
    getGithubToken: () => tokenValue,
    normalizeRepo: (url: string) => url.replace('https://github.com/', ''),
    fetchRepoInfo: async (repo: string) => {
      capturedRepo = repo;
      if (fetchRepoResult instanceof Error) throw fetchRepoResult;
      return fetchRepoResult;
    },
  },
});

const configWithRepo = (repoUrl: string): ShipConfig => ({
  project: { slug: 'test', git: { repoUrl } },
  dir: '.ship',
});

const baseContext = { config: configWithRepo('https://github.com/acme/my-repo') };

beforeEach(() => {
  tokenValue = 'ghp_test';
  capturedRepo = '';
  fetchRepoResult = {
    full_name: 'acme/my-repo',
    description: 'A repo',
    default_branch: 'main',
    stargazers_count: 42,
    open_issues_count: 3,
    visibility: 'public',
  };
});

describe('git/repo/info', () => {
  it('logs repo info from the API response', async () => {
    const { logs } = await runTask(info, { context: baseContext });
    assert.ok(logs.some((l) => l.includes('acme/my-repo')));
    assert.ok(logs.some((l) => l.includes('main')));
    assert.ok(logs.some((l) => l.includes('42')));
  });

  it('uses repo-url param over config', async () => {
    await runTask(info, {
      params: { 'repo-url': 'https://github.com/other/repo' },
      context: baseContext,
    });
    assert.ok(capturedRepo.includes('other/repo'));
  });

  it('throws ExpectedError when no token found', async () => {
    tokenValue = undefined;
    await assert.rejects(
      () => runTask(info, { context: baseContext }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No GitHub token')
    );
  });

  it('throws ExpectedError when no repo url configured', async () => {
    await assert.rejects(
      () => runTask(info, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No repo URL')
    );
  });

  it('throws ExpectedError on API error', async () => {
    fetchRepoResult = new ExpectedError('GitHub API error: 404 Not Found');
    await assert.rejects(
      () => runTask(info, { context: baseContext }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('404')
    );
  });
});
