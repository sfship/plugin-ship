import { strict as assert } from 'node:assert';
import { interpolate, interpolateParams } from '../../src/core/utils.js';

const noVars = (): unknown => undefined;

describe('interpolate', () => {
  it('returns non-string values unchanged', () => {
    assert.equal(interpolate(42, {}, noVars), 42);
    assert.equal(interpolate(true, {}, noVars), true);
    assert.equal(interpolate(null, {}, noVars), null);
  });

  it('returns strings without tokens unchanged', () => {
    assert.equal(interpolate('hello world', {}, noVars), 'hello world');
  });

  it('interpolates ${{ params.x }} from flowParams', () => {
    assert.equal(interpolate('${{ params.env }}', { env: 'dev' }, noVars), 'dev');
  });

  it('interpolates ${{ context.x }} from getVar', () => {
    const getVar = (key: string): unknown => (key === 'targetOrg' ? 'my-org' : undefined);
    assert.equal(interpolate('${{ context.targetOrg }}', {}, getVar), 'my-org');
  });

  it('returns null when the token value is missing', () => {
    assert.equal(interpolate('${{ params.missing }}', {}, noVars), null);
  });

  it('interpolates multiple tokens in one string', () => {
    const getVar = (key: string): unknown => (key === 'org' ? 'scratch' : undefined);
    assert.equal(interpolate('${{ params.env }}-${{ context.org }}', { env: 'dev' }, getVar), 'dev-scratch');
  });
});

describe('interpolateParams', () => {
  it('interpolates all string values in the params object', () => {
    const result = interpolateParams({ alias: '${{ params.env }}', count: 3 }, { env: 'dev' }, noVars);
    assert.deepEqual(result, { alias: 'dev', count: 3 });
  });

  it('returns an empty object unchanged', () => {
    assert.deepEqual(interpolateParams({}, {}, noVars), {});
  });
});
