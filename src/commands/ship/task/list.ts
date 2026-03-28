import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SfCommand, Flags, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { load, getShipDir } from '@plugin-ship/core/config.loader.js';
import tasks from '@plugin-ship/core/tasks/index.js';

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
    const config = load(flags.config);
    const shipDir = getShipDir(flags.config, config);

    const ux = new Ux();

    ux.styledHeader('Built-in Tasks');
    ux.table({
      data: Object.values(tasks)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ name: t.name, description: t.description })),
    });

    let customFiles: string[] = [];
    try {
      customFiles = readdirSync(resolve(shipDir, 'actions'))
        .filter((f) => f.endsWith('.js'))
        .map((f) => f.replace(/\.js$/, ''));
    } catch {
      // no custom tasks directory
    }

    if (customFiles.length > 0) {
      this.log('');
      ux.styledHeader('Custom Tasks');
      ux.table({ data: customFiles.sort().map((name) => ({ name })) });
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
