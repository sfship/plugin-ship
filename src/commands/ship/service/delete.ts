/*
 * Copyright 2026, Salesforce, Inc.
 *
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
import { SfCommand, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { getMeta, deleteToken } from '../../../core/service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.service.delete');

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
