import { resolve } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../core/config.js';

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
    const config = loadConfig(resolve(flags['config']));
    const flows = Object.keys(config.flows ?? {});

    if (flows.length === 0) {
      this.log('No flows defined in ship.yml.');
      return;
    }

    for (const name of flows) {
      this.log(name);
    }
  }
}
