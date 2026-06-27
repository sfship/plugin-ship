import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';

let fetchReleaseResult: { tagName: string } | null = { tagName: 'v0.4.0.1' };
let fetchGitTagResult: { message: string } | null = { message: 'version_id: 04tAAA' };
let capturedPrerelease: boolean | undefined;
let capturedTag: string | undefined;

const releaseTask = await mockTask('git/release/fetch.js', {
  'service.github.js': {
    normalizeRepo: (url: string) => url.replace('https://github.com/', ''),
    fetchRelease: async (repo: string, tag: string | undefined, prerelease: boolean) => {
      capturedPrerelease = prerelease;
      capturedTag = tag;
      return fetchReleaseResult;
    },
    fetchGitTag: async () => fetchGitTagResult,
  },
});

const configWithRepo = (repoUrl: string): ShipConfig => ({
  project: { slug: 'test', git: { repoUrl } },
  dir: '.ship',
});

const baseContext = { config: configWithRepo('https://github.com/acme/my-repo') };

beforeEach(() => {
  fetchReleaseResult = { tagName: 'v0.4.0.1' };
  fetchGitTagResult = { message: 'version_id: 04tAAA' };
  capturedPrerelease = undefined;
  capturedTag = undefined;
});

describe('git/release/fetch', () => {
  it('sets version-id, tag, version-number, and version-base', async () => {
    const { outputs } = await runTask(releaseTask, { context: baseContext });
    assert.equal(outputs['version-id'], '04tAAA');
    assert.equal(outputs['tag'], 'v0.4.0.1');
    assert.equal(outputs['version-number'], '0.4.0.1');
    assert.equal(outputs['version-base'], '0.4.0');
  });

  it('passes prerelease flag', async () => {
    await runTask(releaseTask, { params: { prerelease: true }, context: baseContext });
    assert.equal(capturedPrerelease, true);
  });

  it('passes tag param to fetchRelease', async () => {
    await runTask(releaseTask, { params: { tag: 'v1.2.3' }, context: baseContext });
    assert.equal(capturedTag, 'v1.2.3');
  });

  it('logs the resolved version', async () => {
    const { logs } = await runTask(releaseTask, { context: baseContext });
    assert.ok(logs[0]?.includes('0.4.0.1'));
    assert.ok(logs[0]?.includes('04tAAA'));
  });

  it('throws ExpectedError when no repo URL', async () => {
    await assert.rejects(
      () => runTask(releaseTask, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No repo URL')
    );
  });

  it('throws ExpectedError when no release found', async () => {
    fetchReleaseResult = null;
    await assert.rejects(
      () => runTask(releaseTask, { context: baseContext }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No')
    );
  });

  it('throws ExpectedError when no git tag found', async () => {
    fetchGitTagResult = null;
    await assert.rejects(
      () => runTask(releaseTask, { context: baseContext }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No release metadata')
    );
  });

  it('throws ExpectedError when tag annotation has no version_id', async () => {
    fetchGitTagResult = { message: 'no version here' };
    await assert.rejects(
      () => runTask(releaseTask, { context: baseContext }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No version_id')
    );
  });
});
