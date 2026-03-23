import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.js';
import { buildContext } from '@plugin-ship/core/context.js';
import { resolveAction } from '@plugin-ship/core/utils.js';
import actions from '@plugin-ship/core/actions/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.action.run');

/** Runs a single action directly, outside of a flow. */
export default class ActionRun extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    actionName: Args.string({ description: messages.getMessage('args.actionName.summary'), required: true }),
  };

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
    param: Flags.string({ summary: messages.getMessage('flags.param.summary'), multiple: true }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ActionRun);
    const params = Object.fromEntries(
      (flags.param ?? []).map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), p.slice(i + 1)];
      })
    );
    const configPath = resolve(flags['config']);
    const cwd = resolve(configPath, '..');
    const config = loadConfig(configPath);
    const context = buildContext({ config, cwd, log: (message) => this.log(message) });

    const definition = resolveAction(args.actionName, context, actions);
    await definition.run({ ...context, params });
  }
}
