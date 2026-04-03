import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';

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

    const config = loadConfig(flags.config);
    const shipDir = resolve(flags.config, '..', config.dir);
    const task = await new TaskRunner(shipDir).resolveTask(args.taskName);

    const ux = new Ux();
    this.log(' ');
    ux.styledHeader(task.name);
    this.log(task.description);
    this.log(' ');

    ux.styledHeader('Params');
    ux.table({
      data: task.params.map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required ? 'yes' : 'no',
        description: p.description,
      })),
    });

    if (task.outputs && task.outputs.length > 0) {
      ux.styledHeader('Outputs');
      this.log(
        StandardColors.info('Tip:') + ' Reference these outputs in subsequent steps using ${{ steps.<step-id>.<name> }}'
      );
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
