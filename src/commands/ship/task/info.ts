import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags, Ux } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { load } from '@plugin-ship/core/config.loader.js';
import { resolveTask } from '@plugin-ship/core/flow.runner.js';
import tasks from '@plugin-ship/core/tasks/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.task.info');

/** Shows description, params, and outputs for a task. */
export default class TaskInfo extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    taskName: Args.string({ description: messages.getMessage('args.taskName.summary'), required: true }),
  };

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskInfo);

    const config = load(flags.config);
    const shipDir = resolve(flags.config, '..', config.dir ?? '.ship');
    const task = await resolveTask(args.taskName, shipDir, tasks);

    const ux = new Ux();

    ux.styledHeader(task.name);
    this.log(task.description);
    this.log('');

    ux.styledHeader('Params');
    ux.table({
      data: task.params.map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required ? 'yes' : 'no',
        description: p.description,
      })),
    });

    if (task.outputs.length > 0) {
      this.log('');
      ux.styledHeader('Outputs');
      ux.table({
        data: task.outputs.map((o) => ({
          name: o.name,
          type: o.type,
          description: o.description,
        })),
      });
    }
  }
}
