import { strict as assert } from 'node:assert';
import { interpolate, interpolateParams } from '@plugin-ship/core/interpolate.js';

describe('interpolate', () => {
  it('returns non-string values unchanged', () => {
    assert.equal(interpolate(42, {}, {}), 42);
    assert.equal(interpolate(true, {}, {}), true);
    assert.equal(interpolate(null, {}, {}), null);
  });

  it('returns a plain string unchanged', () => {
    assert.equal(interpolate('hello', {}, {}), 'hello');
  });

  it('interpolates a ${{ params.x }} token', () => {
    assert.equal(interpolate('${{ params.env }}', { env: 'production' }, {}), 'production');
  });

  it('interpolates a ${{ steps.<id>.<key> }} token', () => {
    assert.equal(
      interpolate('${{ steps.create-org.targetOrg }}', {}, { 'create-org': { targetOrg: 'test-org' } }),
      'test-org'
    );
  });

  it('interpolates multiple tokens in a single string', () => {
    assert.equal(interpolate('${{ params.org }}-${{ params.env }}', { org: 'myorg', env: 'dev' }, {}), 'myorg-dev');
  });

  it('returns null when the referenced param does not exist', () => {
    assert.equal(interpolate('${{ params.missing }}', {}, {}), null);
  });

  it('returns null when the referenced step output does not exist', () => {
    assert.equal(interpolate('${{ steps.missing.key }}', {}, {}), null);
  });

  it('returns null for an unknown namespace', () => {
    assert.equal(interpolate('${{ unknown.foo }}', {}, {}), null);
  });

  it('returns null when the path has no keys after the namespace', () => {
    assert.equal(interpolate('${{ params }}', { params: 'foo' }, {}), null);
  });
});

describe('interpolateParams', () => {
  it('interpolates all values in a params object', () => {
    assert.deepEqual(
      interpolateParams({ org: '${{ params.org }}', env: '${{ params.env }}' }, { org: 'myorg', env: 'dev' }, {}),
      { org: 'myorg', env: 'dev' }
    );
  });

  it('leaves non-string values unchanged', () => {
    assert.deepEqual(interpolateParams({ count: 42, flag: true }, {}, {}), { count: 42, flag: true });
  });

  it('returns an empty object for empty params', () => {
    assert.deepEqual(interpolateParams({}, {}, {}), {});
  });
});
