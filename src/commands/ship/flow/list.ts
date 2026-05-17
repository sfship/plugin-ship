import { resolve } from 'node:path';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../../core/config.loader.js';
import { FlowRegistry } from '../../../core/flow.registry.js';
import { renderTree } from '../../../core/util.tree.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.flow.list');

/** Lists all flows defined in ship.yml. */
export default class FlowList extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(FlowList);
    const config = loadConfig(flags.config);
    const registry = new FlowRegistry(resolve(config.dir));
    const names = registry.list();

    if (names.length === 0) {
      this.log('No flows available.');
      return;
    }

    this.log(renderTree(names));
    this.log('');
    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship flow info <path>') +
        ' to see full details for a flow.'
    );
    this.log('');
  }
}
