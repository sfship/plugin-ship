import { SfCommand, Flags, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, getShipDir } from '@plugin-ship/core/config.loader.js';
import { TaskRunner } from '@plugin-ship/core/task.runner.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.action.list');

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
    const shipDir = getShipDir(flags.config, config);

    const ux = new Ux();
    const tasks = new TaskRunner(shipDir).list();

    const groups: Record<string, string[]> = {};
    for (const name of tasks) {
      const group = name.split('/')[0];
      (groups[group] ??= []).push(name);
    }

    for (const group of Object.keys(groups).sort()) {
      this.log(StandardColors.info(`\n=== ${group} ===`));
      ux.table({ data: groups[group].map((name) => ({ name })) });
    }

    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship task info <name>') +
        ' to see full details for a task.'
    );
    this.log('');
  }
}
