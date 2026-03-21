import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../core/config.js';
import { buildContext } from '../../core/context.js';
import { runFlow } from '../../core/flow-runner.js';

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

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
    param: Flags.string({ summary: messages.getMessage('flags.param.summary'), multiple: true }),
  };

  public static readonly enableJsonFlag = false;

  /** Loads the config and runs the specified flow. */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FlowRun);
    const flowParams = Object.fromEntries(
      (flags.param ?? []).map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), p.slice(i + 1)];
      })
    );
    const configPath = resolve(flags['config']);
    const cwd = resolve(configPath, '..');
    const config = loadConfig(configPath);
    const context = buildContext({ config, cwd, log: (message) => this.log(message) });

    await runFlow(args.flowName, config, context, flowParams);
  }
}
