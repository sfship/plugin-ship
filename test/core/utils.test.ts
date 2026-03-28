import { strict as assert } from 'node:assert';
import { parseCliParams } from '../../src/core/param.js';

describe('parseCliParams', () => {
  it('parses a key=value flag into a Params object', () => {
    assert.deepEqual(parseCliParams(['env=dev']), { env: 'dev' });
  });
});
