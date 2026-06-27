/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Args } from '@oclif/core';
import { SfCommand, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { getMeta } from '../../../core/service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.service.info');

/** Shows details for a stored service credential. */
export default class ServiceInfo extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    service: Args.string({ description: messages.getMessage('args.service.summary'), required: true }),
    alias: Args.string({ description: messages.getMessage('args.alias.summary'), default: 'default' }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    this.log('');
    this.styledHeader('Service Info');

    const { args } = await this.parse(ServiceInfo);

    const meta = getMeta(args.service, args.alias);
    if (!meta) {
      this.error(`No credential found for "${args.service}" with alias "${args.alias}".`, { exit: 1 });
    }

    const ux = new Ux();
    this.log('');
    this.log(`${StandardColors.info(meta.service)} ${StandardColors.info('—')} ${StandardColors.success(meta.alias)}`);

    ux.table({
      data: [
        { field: 'Service', value: meta.service },
        { field: 'Account', value: meta.account },
        { field: 'Alias', value: meta.alias },
        { field: 'Scopes', value: meta.scopes.join(', ') || '—' },
      ],
    });
  }
}
