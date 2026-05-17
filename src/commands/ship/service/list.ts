import { SfCommand, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { listMetas } from '../../../core/service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.service.list');

/** Lists all connected services. */
export default class ServiceList extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly enableJsonFlag = false;

  // eslint-disable-next-line @typescript-eslint/require-await
  public async run(): Promise<void> {
    const metas = listMetas();

    const ux = new Ux();
    this.styledHeader('Connected Services');

    if (metas.length === 0) {
      this.log(StandardColors.warning('No services connected'));
      this.log(StandardColors.info('Tip:') + ' Run sf ship service connect to get started.');
      this.log('');
      return;
    }

    ux.table({
      data: metas
        .sort((a, b) => a.service.localeCompare(b.service))
        .map((m) => ({
          service: m.service,
          account: m.account,
          alias: m.alias,
          scopes: m.scopes.join(', ') || '—',
        })),
    });

    this.log('');
    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship service info <service> <alias>') +
        ' to see full details.'
    );
    this.log('');
  }
}
