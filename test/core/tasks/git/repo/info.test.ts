/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';

let tokenValue: string | undefined = 'ghp_test';

const info = await mockTask('git/repo/info.js', {
  'service.github.js': {
    getGithubToken: () => tokenValue,
  },
});

const configWithRepo = (repoUrl: string): ShipConfig => ({
  project: { slug: 'test', git: { repoUrl } },
  dir: '.ship',
});

const mockRepo = {
  full_name: 'acme/my-repo',
  description: 'A repo',
  default_branch: 'main',
  stargazers_count: 42,
  open_issues_count: 3,
  visibility: 'public',
};

const okFetch = (data: object) => (global.fetch = async () => ({ ok: true, json: async () => data } as Response));

beforeEach(() => {
  tokenValue = 'ghp_test';
  okFetch(mockRepo);
});

describe('git/repo/info', () => {
  it('logs repo info from the API response', async () => {
    const { logs } = await runTask(info, { context: { config: configWithRepo('https://github.com/acme/my-repo') } });
    assert.ok(logs.some((l) => l.includes('acme/my-repo')));
    assert.ok(logs.some((l) => l.includes('main')));
    assert.ok(logs.some((l) => l.includes('42')));
  });

  it('uses repo-url param over config', async () => {
    let calledUrl = '';
    global.fetch = async (url: string | URL | Request) => {
      calledUrl = String(url);
      return { ok: true, json: async () => mockRepo } as Response;
    };
    await runTask(info, {
      params: { 'repo-url': 'https://github.com/other/repo' },
      context: { config: configWithRepo('https://github.com/acme/my-repo') },
    });
    assert.ok(calledUrl.includes('other/repo'));
  });

  it('throws ExpectedError when no token found', async () => {
    tokenValue = undefined;
    await assert.rejects(
      () => runTask(info, { context: { config: configWithRepo('https://github.com/acme/my-repo') } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No GitHub token')
    );
  });

  it('throws ExpectedError when no repo url configured', async () => {
    await assert.rejects(
      () => runTask(info, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No repo URL')
    );
  });

  it('throws ExpectedError when repo url cannot be parsed', async () => {
    await assert.rejects(
      () => runTask(info, { params: { 'repo-url': 'https://not-github.com/foo' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('Could not parse')
    );
  });

  it('throws ExpectedError on non-ok API response', async () => {
    global.fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' } as Response);
    await assert.rejects(
      () => runTask(info, { context: { config: configWithRepo('https://github.com/acme/my-repo') } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('404')
    );
  });
});
