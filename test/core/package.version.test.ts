import { strict as assert } from 'node:assert';
import { parseSemver, bump, resolveNextVersion } from '../../src/core/package.version.js';

describe('parseSemver', () => {
  it('parses a bare version string', () => {
    assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3 });
  });

  it('parses a v-prefixed version string', () => {
    assert.deepEqual(parseSemver('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  });

  it('returns null for a string with no version pattern', () => {
    assert.equal(parseSemver('no-version-here'), null);
  });
});

describe('bump', () => {
  const base = { major: 1, minor: 2, patch: 3 };

  it('increments major and resets minor and patch', () => {
    assert.deepEqual(bump(base, 'major'), { major: 2, minor: 0, patch: 0 });
  });

  it('increments minor and resets patch', () => {
    assert.deepEqual(bump(base, 'minor'), { major: 1, minor: 3, patch: 0 });
  });

  it('increments patch', () => {
    assert.deepEqual(bump(base, 'patch'), { major: 1, minor: 2, patch: 4 });
  });

  it('returns the same version for build', () => {
    assert.deepEqual(bump(base, 'build'), { major: 1, minor: 2, patch: 3 });
  });
});

describe('resolveNextVersion', () => {
  it('produces 0.0.0.NEXT when there is no prior release and version-type is build', () => {
    assert.equal(resolveNextVersion(null, 'build'), '0.0.0.NEXT');
  });

  it('bumps minor on an existing release when version-type is build', () => {
    assert.equal(resolveNextVersion('v1.2.3', 'build'), '1.3.0.NEXT');
  });

  it('bumps minor directly when version-type is minor', () => {
    assert.equal(resolveNextVersion('v1.2.3', 'minor'), '1.3.0.NEXT');
  });

  it('bumps major when version-type is major', () => {
    assert.equal(resolveNextVersion('v1.2.3', 'major'), '2.0.0.NEXT');
  });

  it('bumps patch when version-type is patch', () => {
    assert.equal(resolveNextVersion('v1.2.3', 'patch'), '1.2.4.NEXT');
  });

  it('falls back to 0.0.0 base when the tag is unparseable', () => {
    assert.equal(resolveNextVersion('not-a-version', 'minor'), '0.1.0.NEXT');
  });
});
