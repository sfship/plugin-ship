import { strict as assert } from 'node:assert';
import { validateParams, parseCliParams } from '@plugin-ship/core/param.js';
import { ParamDefinition } from '@plugin-ship/core/config.js';

describe('validateParams', () => {
  it('returns an empty object when there are no param definitions', () => {
    assert.deepEqual(validateParams({ foo: 'bar' }, []), {});
  });

  it('resolves a required string param', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.deepEqual(validateParams({ env: 'production' }, defs), { env: 'production' });
  });

  it('throws when a required param is missing', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.throws(() => validateParams({}, defs), /Missing required params/);
  });

  it('throws when a param value is not a scalar', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.throws(() => validateParams({ env: { nested: true } }, defs), /must be a string, number, or boolean/);
  });

  it('omits optional params that are not provided', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: false }];
    assert.deepEqual(validateParams({}, defs), {});
  });

  it('applies a default when the param is not provided', () => {
    const defs: ParamDefinition[] = [{ name: 'duration', type: 'number', default: 7 }];
    assert.deepEqual(validateParams({}, defs), { duration: 7 });
  });

  it('ignores undeclared params', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.deepEqual(validateParams({ env: 'dev', extra: 'ignored' }, defs), { env: 'dev' });
  });

  describe('type coercion', () => {
    it('coerces a string "42" to number when type is number', () => {
      const defs: ParamDefinition[] = [{ name: 'count', type: 'number', required: true }];
      assert.deepEqual(validateParams({ count: '42' }, defs), { count: 42 });
    });

    it('throws when a string cannot be coerced to number', () => {
      const defs: ParamDefinition[] = [{ name: 'count', type: 'number', required: true }];
      assert.throws(() => validateParams({ count: 'abc' }, defs), /expected a number/);
    });

    it('coerces "true" to boolean true', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.deepEqual(validateParams({ flag: 'true' }, defs), { flag: true });
    });

    it('coerces "false" to boolean false', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.deepEqual(validateParams({ flag: 'false' }, defs), { flag: false });
    });

    it('throws when a string cannot be coerced to boolean', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.throws(() => validateParams({ flag: 'yes' }, defs), /expected a boolean/);
    });

    it('coerces a number to string when type is string', () => {
      const defs: ParamDefinition[] = [{ name: 'label', type: 'string', required: true }];
      assert.deepEqual(validateParams({ label: 42 }, defs), { label: '42' });
    });
  });
});

describe('parseCliParams', () => {
  it('parses a single key=value flag', () => {
    assert.deepEqual(parseCliParams(['env=dev']), { env: 'dev' });
  });

  it('parses multiple flags', () => {
    assert.deepEqual(parseCliParams(['env=dev', 'version=1.0.0']), { env: 'dev', version: '1.0.0' });
  });

  it('handles values that contain "="', () => {
    assert.deepEqual(parseCliParams(['url=https://example.com?foo=bar']), { url: 'https://example.com?foo=bar' });
  });

  it('returns an empty object for an empty array', () => {
    assert.deepEqual(parseCliParams([]), {});
  });

  it('throws when a flag is missing "="', () => {
    assert.throws(() => parseCliParams(['invalid']), /Invalid param format/);
  });
});
