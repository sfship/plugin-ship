import { Args } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../../core/config.js';
import { runFlow } from '../../../core/flow-runner.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.flow.run');

/** Executes a named flow defined in `ship.yml`. */
export default class FlowRun extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    flowName: Args.string({ description: messages.getMessage('flags.name.summary'), required: true }),
  };

  public static readonly enableJsonFlag = false;

  /** Loads the config and runs the specified flow. */
  public async run(): Promise<void> {
    const { args } = await this.parse(FlowRun);
    const config = loadConfig(process.cwd());
    await runFlow(args.flowName, config, {
      log: (message) => this.log(message),
    });
  }
}
