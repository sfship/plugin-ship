import { Task } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

class StubTask extends Task {
  public readonly name = 'stub-task';
  public readonly description = 'A stub task for testing.';
  public readonly params: ParamDefinition[] = [];
  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {}
}

export default new StubTask();
