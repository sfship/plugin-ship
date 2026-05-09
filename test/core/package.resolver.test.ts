/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import type { resolveDependencies as ResolveFn } from '@plugin-ship/core/package.resolver.js';

type Resolver = { resolveDependencies: typeof ResolveFn };

const { resolveDependencies }: Resolver = await esmock('../../src/core/package.resolver.js', {
  '../../src/core/service.github.js': { getGithubToken: () => undefined },
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

  describe('CCI GitHub dep', () => {
    const tagMsg = cciTagMessage('04tAAAAAAAAAAAAAAA', [
      { version_id: '04tBBBBBBBBBBBBBBB', package_name: 'Transitive' },
    ]);

    beforeEach(() => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: tagMsg }],
        ['raw.githubusercontent.com', 404, ''],
        ['/contents/', 404, {}]
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

    it('includes the tag in the error when a pinned tag has no release', async () => {
      stubFetch(['/releases/tags/v9.0', 404, {}]);
      await assert.rejects(
        () => resolveDependencies([{ github: 'org/repo', type: 'cci', tag: 'v9.0' }]),
        /No GitHub release found for org\/repo@v9\.0/
      );
    });

    it('throws when fetchGitTag returns null (lightweight tag)', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 404, {}],
        ['raw.githubusercontent.com', 404, ''],
        ['/contents/', 404, {}]
      );
      await assert.rejects(() => resolveDependencies([{ github: 'org/repo', type: 'cci' }]), /No CCI release metadata/);
    });

    it('throws when the tag has no CCI metadata', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: 'just a plain release message' }],
        ['raw.githubusercontent.com', 404, ''],
        ['/contents/', 404, {}]
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

    it('throws when ship.yml is missing', async () => {
      stubFetch(['/releases/latest', 200, { tag_name: 'v1.0' }], ['raw.githubusercontent.com', 404, '']);
      await assert.rejects(() => resolveDependencies([{ github: 'org/other', type: 'ship' }]), /ship\.yml not found/);
    });

    it('throws when ship.yml fails schema validation', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'v1.0' }],
        ['raw.githubusercontent.com', 200, 'not_a_valid_ship_yml: true']
      );
      await assert.rejects(() => resolveDependencies([{ github: 'org/other', type: 'ship' }]), /Invalid ship\.yml/);
    });

    it('throws on circular dependencies', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'v1.0' }],
        [
          'raw.githubusercontent.com',
          200,
          'project:\n  name: self\ndependencies:\n  - github: org/repo\n    type: ship',
        ]
      );
      await assert.rejects(
        () => resolveDependencies([{ github: 'org/repo', type: 'ship' }]),
        /Circular dependency detected/
      );
    });
  });

  describe('pinned tag', () => {
    it('fetches release by tag when tag is specified', async () => {
      const captured: string[] = [];
      global.fetch = async (input: string | URL | Request): Promise<Response> => {
        captured.push(String(input));
        const url = String(input);
        if (url.includes('/releases/tags/'))
          return { ok: true, status: 200, json: async () => ({ tag_name: 'v1.0' }), text: async () => '' } as Response;
        if (url.includes('/git/refs/tags/'))
          return {
            ok: true,
            status: 200,
            json: async () => ({ object: { type: 'tag', sha: 'abc' } }),
            text: async () => '',
          } as Response;
        if (url.includes('raw.githubusercontent.com') || url.includes('/contents/'))
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response;
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: 'version_id: 04tAAAAAAAAAAAAAAA\n\ndependencies: []' }),
          text: async () => '',
        } as Response;
      };
      await resolveDependencies([{ github: 'org/repo', type: 'cci', tag: 'v1.0' }]);
      assert.ok(captured.some((u) => u.includes('/releases/tags/v1.0')));
    });
  });

  describe('CCI metadata steps', () => {
    it('emits pre and post metadata steps around the package install step', async () => {
      const tagMsg = cciTagMessage('04tAAAAAAAAAAAAAAA', []);
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: tagMsg }],
        ['raw.githubusercontent.com', 404, ''],
        ['unpackaged/pre', 200, [{ name: 'SharedUtils', type: 'dir' }]],
        ['unpackaged/post', 200, [{ name: 'Config', type: 'dir' }]]
      );
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci', name: 'My Pkg' }]);
      assert.equal(steps.length, 3);
      assert.equal(steps[0].kind, 'metadata');
      assert.equal((steps[0] as { subfolder: string }).subfolder, 'unpackaged/pre/SharedUtils');
      assert.equal(steps[1].kind, 'package-id');
      assert.equal(steps[2].kind, 'metadata');
      assert.equal((steps[2] as { subfolder: string }).subfolder, 'unpackaged/post/Config');
    });

    it('includes the namespace from cumulusci.yml in metadata steps', async () => {
      const tagMsg = cciTagMessage('04tAAAAAAAAAAAAAAA', []);
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: tagMsg }],
        ['raw.githubusercontent.com', 200, 'project:\n  package:\n    namespace: npsp'],
        ['unpackaged/pre', 200, [{ name: 'pre', type: 'dir' }]],
        ['unpackaged/post', 200, []]
      );
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci' }]);
      const metaStep = steps[0] as { namespace: string };
      assert.equal(metaStep.namespace, 'npsp');
    });
  });

  describe('parseCciTagMessage', () => {
    it('returns own version ID with empty deps when tag message dependencies JSON is malformed', async () => {
      stubFetch(
        ['/releases/latest', 200, { tag_name: 'rel/1.0' }],
        ['/git/refs/tags/', 200, { object: { type: 'tag', sha: 'abc123' } }],
        ['/git/tags/abc123', 200, { message: 'version_id: 04tAAAAAAAAAAAAAAA\n\ndependencies: [invalid' }],
        ['raw.githubusercontent.com', 404, ''],
        ['/contents/', 404, {}]
      );
      const steps = await resolveDependencies([{ github: 'org/repo', type: 'cci', name: 'My Package' }]);
      assert.deepEqual(steps, [{ kind: 'package-id', versionId: '04tAAAAAAAAAAAAAAA', name: 'My Package' }]);
    });
  });
});
