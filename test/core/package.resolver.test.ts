/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import type { resolveDependencies as ResolveFn } from '../../src/core/package.resolver.js';

type Resolver = { resolveDependencies: typeof ResolveFn };
type Release = { tagName: string };
type GitTag = { message: string };

let fetchReleaseStub: (repo: string, tag?: string) => Promise<Release | null> = async () => null;
let fetchGitTagStub: (repo: string, tag: string) => Promise<GitTag | null> = async () => null;
let fetchCciNamespaceStub: () => Promise<string> = async () => '';
let fetchSubdirsStub: (repo: string, tag: string, path: string) => Promise<string[]> = async () => [];

const { resolveDependencies }: Resolver = await esmock('../../src/core/package.resolver.js', {
  '../../src/core/service.github.js': {
    normalizeRepo: (r: string) => r,
    fetchRelease: (repo: string, tag?: string) => fetchReleaseStub(repo, tag),
    fetchGitTag: (repo: string, tag: string) => fetchGitTagStub(repo, tag),
    fetchCciNamespace: () => fetchCciNamespaceStub(),
    fetchSubdirs: (repo: string, tag: string, path: string) => fetchSubdirsStub(repo, tag, path),
  },
});

beforeEach(() => {
  fetchReleaseStub = async () => null;
  fetchGitTagStub = async () => null;
  fetchCciNamespaceStub = async () => '';
  fetchSubdirsStub = async () => [];
});

function tagMessage(versionId: string, deps: Array<{ version_id: string; package_name?: string }> = []): string {
  return `version_id: ${versionId}\npackage_type: 2GP\ndependencies: ${JSON.stringify(deps)}`;
}

describe('resolveDependencies', () => {
  describe('versionId dep', () => {
    it('returns a package-id step', async () => {
      const steps = await resolveDependencies([{ versionId: '04tAAAAAAAAAAAAAAA', name: 'My Package' }]);
      assert.deepEqual(steps, [{ kind: 'package-id', versionId: '04tAAAAAAAAAAAAAAA', name: 'My Package' }]);
    });

    it('deduplicates repeated version IDs', async () => {
      const steps = await resolveDependencies([
        { versionId: '04tAAAAAAAAAAAAAAA' },
        { versionId: '04tAAAAAAAAAAAAAAA' },
      ]);
      assert.equal(steps.length, 1);
    });
  });

  describe('github dep', () => {
    it('throws when no release is found', async () => {
      await assert.rejects(() => resolveDependencies([{ github: 'org/repo' }]), /No GitHub release found/);
    });

    it('throws when the release tag has no version metadata', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: 'just a plain message' });
      await assert.rejects(() => resolveDependencies([{ github: 'org/repo' }]), /No release metadata found/);
    });

    it('throws on a circular github dependency', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: tagMessage('04tAAAAAAAAAAAAAAA') });
      await assert.rejects(
        () => resolveDependencies([{ github: 'org/repo' }, { github: 'org/repo' }]),
        /Circular dependency/
      );
    });

    it('resolves to a package-id step for the main version', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: tagMessage('04tAAAAAAAAAAAAAAA') });
      const steps = await resolveDependencies([{ github: 'org/repo', name: 'My Pkg' }]);
      assert.deepEqual(steps, [{ kind: 'package-id', versionId: '04tAAAAAAAAAAAAAAA', name: 'My Pkg' }]);
    });

    it('places transitive package-id steps before the main version', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({
        message: tagMessage('04tAAAAAAAAAAAAAAA', [{ version_id: '04tBBBBBBBBBBBBBBB', package_name: 'Dep' }]),
      });
      const steps = await resolveDependencies([{ github: 'org/repo' }]);
      assert.equal(steps.length, 2);
      assert.equal(steps[0].versionId, '04tBBBBBBBBBBBBBBB');
      assert.equal(steps[1].versionId, '04tAAAAAAAAAAAAAAA');
    });

    it('wraps the package install with pre and post metadata steps', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: tagMessage('04tAAAAAAAAAAAAAAA') });
      fetchCciNamespaceStub = async () => 'myns';
      fetchSubdirsStub = async (_r, _t, path) =>
        path === 'unpackaged/pre' ? ['unpackaged/pre/step1'] : ['unpackaged/post/step2'];
      const steps = await resolveDependencies([{ github: 'org/repo' }]);
      assert.equal(steps.length, 3);
      assert.equal(steps[0].kind, 'metadata');
      assert.equal(steps[0].subfolder, 'unpackaged/pre/step1');
      assert.equal(steps[1].kind, 'package-id');
      assert.equal(steps[2].kind, 'metadata');
      assert.equal(steps[2].subfolder, 'unpackaged/post/step2');
    });

    it('treats malformed dependency JSON as no transitive deps', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: 'version_id: 04tAAAAAAAAAAAAAAA\ndependencies: [{bad json}]' });
      const steps = await resolveDependencies([{ github: 'org/repo' }]);
      assert.equal(steps.length, 1);
      assert.equal(steps[0].kind, 'package-id');
    });

    it('handles a tag message with no dependencies field', async () => {
      fetchReleaseStub = async () => ({ tagName: 'v1.0.0' });
      fetchGitTagStub = async () => ({ message: 'version_id: 04tAAAAAAAAAAAAAAA\npackage_type: 2GP' });
      const steps = await resolveDependencies([{ github: 'org/repo' }]);
      assert.equal(steps.length, 1);
    });
  });
});
