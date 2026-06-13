import { strict as assert } from 'node:assert';
import esmock from 'esmock';
import type { resolveDependencies as ResolveFn } from '../../src/core/package.resolver.js';

type Resolver = { resolveDependencies: typeof ResolveFn };

const { resolveDependencies }: Resolver = await esmock('../../src/core/package.resolver.js', {
  '../../src/core/service.github.js': { getGithubToken: () => undefined },
});

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
});
