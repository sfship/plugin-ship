import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { parseCliParams, validateParams } from '@plugin-ship/core/param.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';
import { TaskContext } from '@plugin-ship/core/task.js';
import { Store } from '@plugin-ship/core/store.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.task.run');

/** Runs a single task directly, outside of a flow. */
export default class TaskRun extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    taskName: Args.string({ description: messages.getMessage('args.taskName.summary'), required: true }),
  };

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
    param: Flags.string({ summary: messages.getMessage('flags.param.summary'), multiple: true }),
  };

  public static readonly enableJsonFlag = false;

  /**
   * Loads the ship.yml config, resolves the named task, builds a flow context,
   * validates params, and runs the task.
   *
   * @throws If the config is invalid, the task cannot be resolved, or params fail validation.
   */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskRun);

    const params = parseCliParams(flags.param ?? []);
    const config = loadConfig(flags.config);
    const shipDir = resolve(flags.config, '..', config.dir);

    const context: FlowContext = {
      shipDir,
      config,
      orgs: new OrgRegistry(resolve(shipDir, 'orgs'), config.project.name),
      log: (message: string) => this.log(message),
      params,
    };

    const runner = new TaskRunner(shipDir);
    const task = await runner.resolveTask(args.taskName);
    const validatedParams = validateParams(params, task.params);

    const store = new Store();
    const output = store.getTaskOutput(args.taskName);
    const taskContext: TaskContext = { flow: context, params: validatedParams, output };

    await task.run(taskContext);
  }
}
