import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../../core/config.loader.js';
import { builtinsDir } from '../../../core/flow.registry.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.flow.eject');

/** Copies a built-in flow into the project for customization. */
export default class FlowEject extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    flowName: Args.string({ description: messages.getMessage('args.flowName.summary'), required: true }),
  };

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FlowEject);

    const config = loadConfig(flags.config);
    const projectDir = resolve(dirname(flags.config));
    const shipDir = join(projectDir, config.dir);

    const src = join(builtinsDir, `${args.flowName}.yml`);
    this.log(src);
    if (!existsSync(src)) {
      this.error(`"${args.flowName}" is not a built-in flow.`, { exit: 1 });
    }

    const dest = join(shipDir, 'flows', `${args.flowName}.yml`);
    if (existsSync(dest)) {
      this.error(`${dest} already exists. Remove it first if you want to re-eject.`, { exit: 1 });
    }

    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    this.log(`Ejected to ${dest}`);
  }
}
