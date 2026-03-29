import { strict as assert } from 'node:assert';
import { Task } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

class TestTask extends Task {
  public readonly name = 'test-task';
  public readonly description = 'A task for testing.';
  public readonly params: ParamDefinition[] = [
    { name: 'required-param', type: 'string', required: true },
    { name: 'optional-param', type: 'number', required: false },
  ];
  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {}
}

const task = new TestTask();

describe('Task.validate', () => {
  it('returns validated params when all required params are provided', () => {
    const result = task.validate({ 'required-param': 'hello' });
    assert.deepEqual(result, { 'required-param': 'hello' });
  });

  it('throws with the task name when a required param is missing', () => {
    assert.throws(
      () => task.validate({}),
      (err: Error) => {
        assert.ok(err.message.includes('test-task'));
        assert.ok(err.message.includes('required-param'));
        return true;
      }
    );
  });

  it('throws with the task name when a param has the wrong type', () => {
    assert.throws(
      () => task.validate({ 'required-param': 'hello', 'optional-param': 'not-a-number' }),
      (err: Error) => {
        assert.ok(err.message.includes('test-task'));
        return true;
      }
    );
  });

  it('includes optional params when provided', () => {
    const result = task.validate({ 'required-param': 'hello', 'optional-param': 42 });
    assert.deepEqual(result, { 'required-param': 'hello', 'optional-param': 42 });
  });

  it('omits optional params when not provided', () => {
    const result = task.validate({ 'required-param': 'hello' });
    assert.equal('optional-param' in result, false);
  });
});
