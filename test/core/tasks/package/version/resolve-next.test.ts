import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import { VERSION_TYPES } from '../../../../../src/core/package.version.js';

type Release = { tagName: string };

let fetchReleaseResult: Release | null = null;
let resolveNextVersionResult = '1.3.0.NEXT';

const resolveNext = await mockTask('package/version/resolve-next.js', {
  'service.github.js': {
    normalizeRepo: (r: string) => r,
    fetchRelease: async () => fetchReleaseResult,
  },
  'package.version.js': {
    VERSION_TYPES,
    resolveNextVersion: () => resolveNextVersionResult,
  },
});

beforeEach(() => {
  fetchReleaseResult = null;
  resolveNextVersionResult = '1.3.0.NEXT';
});

describe('package/version/resolve-next', () => {
  it('sets version-number output to the resolved version', async () => {
    resolveNextVersionResult = '2.0.0.NEXT';
    const { outputs } = await runTask(resolveNext, { params: { 'version-type': 'major', 'repo-url': 'org/repo' } });
    assert.equal(outputs['version-number'], '2.0.0.NEXT');
  });

  it('logs the release tag when a release exists', async () => {
    fetchReleaseResult = { tagName: 'v1.2.3' };
    const { logs } = await runTask(resolveNext, { params: { 'version-type': 'build', 'repo-url': 'org/repo' } });
    assert.ok(logs[0]?.includes('v1.2.3'));
  });

  it('logs "No prior GitHub release found" when there is no release', async () => {
    const { logs } = await runTask(resolveNext, { params: { 'version-type': 'build', 'repo-url': 'org/repo' } });
    assert.ok(logs[0]?.includes('No prior GitHub release found'));
  });

  it('throws ExpectedError for an invalid version-type', async () => {
    await assert.rejects(
      () => runTask(resolveNext, { params: { 'version-type': 'weekly', 'repo-url': 'org/repo' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('Invalid version-type')
    );
  });

  it('throws ExpectedError when no repo URL is available', async () => {
    await assert.rejects(
      () => runTask(resolveNext, { params: { 'version-type': 'build' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No repo URL')
    );
  });
});
