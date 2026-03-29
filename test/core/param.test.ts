import { strict as assert } from 'node:assert';
import { validate, parseCliParams } from '@plugin-ship/core/param.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

describe('validate', () => {
  it('returns an empty object when there are no param definitions', () => {
    assert.deepEqual(validate({ foo: 'bar' }, []), {});
  });

  it('resolves a required string param', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.deepEqual(validate({ env: 'production' }, defs), { env: 'production' });
  });

  it('throws when a required param is missing', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.throws(() => validate({}, defs), /Missing required param "env"/);
  });

  it('throws when a param value is not a scalar', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.throws(() => validate({ env: { nested: true } }, defs), /must be a string, number, or boolean/);
  });

  it('omits optional params that are not provided', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: false }];
    assert.deepEqual(validate({}, defs), {});
  });

  it('applies a default when the param is not provided', () => {
    const defs: ParamDefinition[] = [{ name: 'duration', type: 'number', default: 7 }];
    assert.deepEqual(validate({}, defs), { duration: 7 });
  });

  it('ignores undeclared params', () => {
    const defs: ParamDefinition[] = [{ name: 'env', type: 'string', required: true }];
    assert.deepEqual(validate({ env: 'dev', extra: 'ignored' }, defs), { env: 'dev' });
  });

  describe('type coercion', () => {
    it('coerces a string "42" to number when type is number', () => {
      const defs: ParamDefinition[] = [{ name: 'count', type: 'number', required: true }];
      assert.deepEqual(validate({ count: '42' }, defs), { count: 42 });
    });

    it('throws when a string cannot be coerced to number', () => {
      const defs: ParamDefinition[] = [{ name: 'count', type: 'number', required: true }];
      assert.throws(() => validate({ count: 'abc' }, defs), /expected a number/);
    });

    it('coerces "true" to boolean true', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.deepEqual(validate({ flag: 'true' }, defs), { flag: true });
    });

    it('coerces "false" to boolean false', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.deepEqual(validate({ flag: 'false' }, defs), { flag: false });
    });

    it('throws when a string cannot be coerced to boolean', () => {
      const defs: ParamDefinition[] = [{ name: 'flag', type: 'boolean', required: true }];
      assert.throws(() => validate({ flag: 'yes' }, defs), /expected a boolean/);
    });

    it('coerces a number to string when type is string', () => {
      const defs: ParamDefinition[] = [{ name: 'label', type: 'string', required: true }];
      assert.deepEqual(validate({ label: 42 }, defs), { label: '42' });
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
