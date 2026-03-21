import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../core/config.js';
import { getShipDir } from '../../core/utils.js';
import actions from '../../core/actions/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.action.list');

/** Lists all available actions. */
export default class ActionList extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(ActionList);
    const configPath = resolve(flags['config']);
    const cwd = resolve(configPath, '..');
    const config = loadConfig(configPath);
    const shipDir = getShipDir(cwd, config);

    this.log('Core actions:');
    for (const name of Object.keys(actions)) {
      this.log(`  ${name}`);
    }

    let customFiles: string[] = [];
    try {
      customFiles = readdirSync(resolve(shipDir, 'actions'))
        .filter((f) => f.endsWith('.js'))
        .map((f) => f.replace(/\.js$/, ''));
    } catch {
      // no custom actions directory
    }

    if (customFiles.length > 0) {
      this.log('Custom actions:');
      for (const name of customFiles) {
        this.log(`  ${name}`);
      }
    }
  }
}
