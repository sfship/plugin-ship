import { strict as assert } from 'node:assert';
import { formatTaskPreview } from '../../src/core/task.view.js';

describe('formatTaskPreview', () => {
  it('returns name only when description is absent', () => {
    const result = formatTaskPreview({ name: 'my-task', description: undefined });
    assert.match(result, /my-task/);
    assert.doesNotMatch(result, /Description/);
  });

  it('includes description when present', () => {
    const result = formatTaskPreview({ name: 'my-task', description: 'does a thing' });
    assert.match(result, /my-task/);
    assert.match(result, /Description/);
    assert.match(result, /does a thing/);
  });
});
