/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import type { resolveDependencies as ResolveFn } from '@plugin-ship/core/dependency.resolver.js';

type Resolver = { resolveDependencies: typeof ResolveFn };

const { resolveDependencies }: Resolver = await esmock('../../src/core/dependency.resolver.js', {
  '../../src/core/services/github.js': { getGithubToken: () => undefined },
});

// ---- fetch helpers -------------------------------------------------------

type RouteBody = Record<string, unknown> | string;
type Route = [pattern: string | RegExp, status: number, body: RouteBody];

function stubFetch(...routes: Route[]): void {
  global.fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const route = routes.find(([p]) => (typeof p === 'string' ? url.includes(p) : p.test(url)));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    const [, status, body] = route;
    const isJson = typeof body !== 'string';
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (isJson ? JSON.stringify(body) : body),
    } as Response;
  };
}

function cciTagMessage(versionId: string, deps: Array<{ version_id: string; package_name: string }>): string {
  return `Release\n\nversion_id: ${versionId}\n\npackage_type: 1GP\n\ndependencies: ${JSON.stringify(deps, null, 2)}`;
}

// ---- tests ---------------------------------------------------------------

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

  describe('namespace dep', () => {
    it('returns a package-namespace step', async () => {
      const steps = await resolveDependencies([{ namespace: 'npsp', version: '3.232' }]);
      assert.deepEqual(steps, [{ kind: 'package-namespace', namespace: 'npsp', version: '3.232' }]);
    });
  });

  describe('CCI GitHub dep', () => {
    const tagMsg = cciTagMessage('04tAAAAAAAAAAAAAAA', [
      { version_id: '04tBBBBBBBBBBBBBBB', package_name: 'Transitive' },
    ]);

    beforeEach(() => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: tagMsg }]
      );
    });

    it('returns transitive deps before the repo own package', async () => {
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci' }]);
      assert.equal(steps.length, 2);
      assert.equal(steps[0].kind, 'package-id');
      assert.equal((steps[0] as { versionId: string }).versionId, '04tBBBBBBBBBBBBBBB');
      assert.equal(steps[1].kind, 'package-id');
      assert.equal((steps[1] as { versionId: string }).versionId, '04tAAAAAAAAAAAAAAA');
    });

    it('uses dep.name for the repo own package step', async () => {
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci', name: 'My Dep' }]);
      assert.equal((steps[1] as { name?: string }).name, 'My Dep');
    });

    it('uses package_name from tag message for transitive steps', async () => {
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci' }]);
      assert.equal((steps[0] as { name?: string }).name, 'Transitive');
    });

    it('deduplicates version IDs that appear in multiple dep trees', async () => {
      const steps = await resolveDependencies([
        { github: 'org/repo', type: 'cci' },
        { versionId: '04tBBBBBBBBBBBBBBB' }, // same as the transitive dep above
      ]);
      assert.equal(steps.filter((s) => 'versionId' in s && s.versionId === '04tBBBBBBBBBBBBBBB').length, 1);
    });

    it('throws when no release exists', async () => {
      stubFetch(['/releases/latest', 404, {}]);
      await assert.rejects(() => resolveDependencies([{ github: 'org/repo', type: 'cci' }]), /No GitHub release found/);
    });

    it('throws when the tag has no CCI metadata', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: 'just a plain release message' }]
      );
      await assert.rejects(() => resolveDependencies([{ github: 'org/repo', type: 'cci' }]), /No CCI release metadata/);
    });
  });

  describe('ship GitHub dep', () => {
    it('fetches ship.yml and recurses into its dependencies', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'v1.0' }],
        [
          'raw.githubusercontent.com',
          200,
          'project:\n  name: other\ndependencies:\n  - versionId: "04tCCCCCCCCCCCCCCC"\n    name: Nested',
        ]
      );
      const steps = await resolveDependencies([{ github: 'org/other', type: 'ship' }]);
      assert.deepEqual(steps, [{ kind: 'package-id', versionId: '04tCCCCCCCCCCCCCCC', name: 'Nested' }]);
    });
  });
});
