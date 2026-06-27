import { Args } from '@oclif/core';
import { SfCommand, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { getMeta, deleteToken } from '../../../core/service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.service.delete');

/** Removes a stored service credential. */
export default class ServiceDelete extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    service: Args.string({ description: messages.getMessage('args.service.summary'), required: true }),
    alias: Args.string({ description: messages.getMessage('args.alias.summary'), default: 'default' }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args } = await this.parse(ServiceDelete);

    this.log('');
    this.styledHeader('Service Delete');

    const alias = args.alias;
    const meta = getMeta(args.service, alias);
    if (!meta) {
      this.error(`No credential found for "${args.service}" with alias "${alias}".`, { exit: 1 });
    }

    deleteToken(args.service, meta.account, alias);

    this.log(StandardColors.success('✓') + ` Removed ${args.service} credential ` + StandardColors.success(alias));
    this.log('');
  }
}
