import { Task, TaskContext } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

/** Sets a key/value pair in the flow store, making it available to subsequent steps via `${{ store.key }}`. */
export default new (class StoreSet extends Task {
  public readonly name = 'store/set';
  public readonly description = 'Sets a key/value pair in the flow store.';
  public readonly params: ParamDefinition[] = [
    { name: 'key', type: 'string', required: true, description: 'The store key to set.' },
    { name: 'value', type: 'string', required: true, description: 'The value to store.' },
  ];

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  public async run({ flow, params }: TaskContext): Promise<void> {
    flow.store.set(params['key'] as string, params['value'] as string);
  }
})();
