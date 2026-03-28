import { Task, TaskContext } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

/** Logs a message to the flow output. Useful for progress indicators and debug output in flows. */
export default new (class UtilLog extends Task {
  public readonly name = 'util/log';
  public readonly description = 'Logs a message to the flow output.';
  public readonly params: ParamDefinition[] = [
    /** The message to print. */
    { name: 'message', type: 'string', required: true, description: 'The message to log.' },
  ];

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  public async run({ flow, params }: TaskContext): Promise<void> {
    flow.log(params['message'] as string);
  }
})();
