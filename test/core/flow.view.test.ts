import { strict as assert } from 'node:assert';
import { formatFlowPreview } from '../../src/core/flow.view.js';

describe('formatFlowPreview', () => {
  it('returns flow name only when description is absent', () => {
    const result = formatFlowPreview('deploy/beta');
    assert.match(result, /deploy\/beta/);
    assert.doesNotMatch(result, /Description/);
  });

  it('includes description when present', () => {
    const result = formatFlowPreview('deploy/beta', 'Builds and deploys a beta package');
    assert.match(result, /deploy\/beta/);
    assert.match(result, /Description/);
    assert.match(result, /Builds and deploys a beta package/);
  });
});
