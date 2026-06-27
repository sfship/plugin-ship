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
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, resolveProjectPaths } from '../../../core/config.loader.js';
import { TaskRegistry } from '../../../core/task.registry.js';
import { renderTree } from '../../../core/tree.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.task.list');

/** Lists all available tasks. */
export default class TaskList extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { flags } = await this.parse(TaskList);
    const config = loadConfig(flags.config);
    const { shipDir } = resolveProjectPaths(flags.config, config);

    const tasks = new TaskRegistry(shipDir).list();

    this.log('');
    this.styledHeader('Task List');
    this.log(renderTree(tasks));
    this.log(
      StandardColors.info('Tip:') +
        ' Run ' +
        StandardColors.success('sf ship task info <path>') +
        ' to see full details for a task.'
    );
    this.log('');
  }
}
