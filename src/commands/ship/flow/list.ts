import { resolve } from 'node:path';
import { SfCommand, Flags, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { FlowRegistry } from '@plugin-ship/core/flow.registry.js';

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

    const ux = new Ux();
    ux.styledHeader(`Flows  (${config.project.name})`);

    if (names.length === 0) {
      this.log('No flows available.');
      return;
    }

    ux.table({
      data: names.map((name) => {
        const flow = registry.resolveFlow(name);
        return { name, steps: Object.keys(flow.steps).length, description: flow.description ?? '—' };
      }),
    });

    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship flow info <name>') +
        ' to see full details for a flow.'
    );
    this.log('');
  }
}
