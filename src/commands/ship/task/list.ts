import { resolve } from 'node:path';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../../core/config.loader.js';
import { TaskRegistry } from '../../../core/task.registry.js';
import { renderTree } from '../../../core/util.tree.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.task.list');

/** Lists all available tasks. */
export default class TaskList extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(TaskList);
    const config = loadConfig(flags.config);
    const shipDir = resolve(config.dir);

    const tasks = new TaskRegistry(shipDir).list();

    this.styledHeader('Task List');
    this.log(renderTree(tasks));
    this.log('');
    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship task info <path>') +
        ' to see full details for a task.'
    );
    this.log('');
  }
}
