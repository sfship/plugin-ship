import { resolve, dirname, join } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { createFlowContext } from '@plugin-ship/core/flow.context.js';
import { parseCliParams, validateParams } from '@plugin-ship/core/task.param.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';
import { TaskRegistry } from '@plugin-ship/core/task.registry.js';
import { TaskContext } from '@plugin-ship/core/task.js';
import { Store } from '@plugin-ship/core/flow.store.js';
import { handleError } from '@plugin-ship/core/util.error.js';

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

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskRun);

    const params = parseCliParams(flags.param ?? []);
    const config = loadConfig(flags.config);
    const projectDir = resolve(dirname(flags.config));
    const shipDir = join(projectDir, config.dir);

    const context = createFlowContext({
      projectDir,
      shipDir,
      config,
      orgs: new OrgRegistry(resolve(shipDir, 'orgs'), config.project.name),
      log: (message: string) => this.log(message),
      params,
      runCommand: (id: string, argv: string[]) => this.config.runCommand(id, argv),
    });

    const runner = new TaskRegistry(shipDir);
    const task = await runner.resolveTask(args.taskName);

    new Ux().styledHeader(`Task: ${task.name}`);
    const validatedParams = validateParams(params, task.params);

    const store = new Store();
    const output = store.getTaskOutput(args.taskName);
    const taskContext: TaskContext = { flow: context, params: validatedParams, output };

    try {
      await task.run(taskContext);
    } catch (err) {
      handleError(err, (msg) => this.log(msg));
    }
    this.log('');
  }
}
