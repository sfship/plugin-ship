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
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, resolveProjectPaths } from '../../../core/config.loader.js';
import { FlowRegistry, builtinsDir } from '../../../core/flow.registry.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.flow.eject');

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

    this.log('');
    this.styledHeader('Flow Eject');

    const config = loadConfig(flags.config);
    const { shipDir } = resolveProjectPaths(flags.config, config);

    const src = new FlowRegistry(shipDir).builtinSource(args.flowName);
    if (!src) {
      this.error(`"${args.flowName}" is not a built-in flow.`, { exit: 1 });
    }

    const dest = join(shipDir, 'flows', relative(builtinsDir, src));
    if (existsSync(dest)) {
      this.error(`${dest} already exists. Remove it first if you want to re-eject.`, { exit: 1 });
    }

    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    this.log(StandardColors.success('✓') + ` Ejected flow to: ${dest}`);
    this.log('');
  }
}
