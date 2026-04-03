import type { Task, TaskContext } from '@plugin-ship/core/task.js';

/** Logs a message to the flow output. Useful for progress indicators and debug output in flows. */
export default {
  name: 'util/log',
  description: 'Logs a message to the flow output.',
  params: [{ name: 'message', type: 'string', required: true, description: 'The message to log.' }],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params }: TaskContext): Promise<void> {
    flow.log(params['message'] as string);
  },
} satisfies Task;
