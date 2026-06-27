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
import { basename, dirname, resolve } from 'node:path';
import { input, select } from '@inquirer/prompts';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { initProject } from '../../../core/project.init.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.project.init');

export default class ProjectInit extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;

  public static readonly flags = {
    template: Flags.string({
      summary: messages.getMessage('flags.template.summary'),
      default: 'standard',
    }),
    'api-version': Flags.string({
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    'lwc-language': Flags.string({
      summary: messages.getMessage('flags.lwc-language.summary'),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ProjectInit);

    const packageName = await input({ message: 'Project Name:' });
    const namespaceRaw = await input({ message: 'Namespace:' });
    const namespace = namespaceRaw.trim() || undefined;
    const packageType = await select({
      message: 'Package Type:',
      choices: [
        { value: 'Managed', name: '2GP Managed' },
        { value: 'Unlocked', name: 'Unlocked' },
      ],
    });
    const repoUrlRaw = await input({ message: 'GitHub Repository URL:' });
    const repoUrl = repoUrlRaw.trim() || undefined;

    const cwd = resolve('.');
    const generateArgs = ['--name', basename(cwd), '--template', flags.template, '--output-dir', dirname(cwd)];
    if (flags['api-version']) generateArgs.push('--api-version', flags['api-version']);
    if (flags['lwc-language']) generateArgs.push('--lwc-language', flags['lwc-language']);

    this.log('');
    await this.config.runCommand('project:generate', generateArgs);

    const { created, skipped } = initProject({ packageName, namespace, packageType, repoUrl }, cwd);

    this.log('');
    for (const f of created) this.log(`  created  ${f}`);
    for (const f of skipped) {
      if (f === 'README.md') {
        this.log(`  skipped  ${f} — your project already has one. See the SF Ship docs for recommended content.`);
      } else {
        this.log(`  skipped  ${f} (already exists)`);
      }
    }
    this.log('');
    this.styledHeader('Project Initialized!');
    this.styledObject({
      'Next steps': StandardColors.success(`${cwd}/README.md`),
      'VS Code': 'Reload the window to activate the Salesforce extensions.',
    });
    this.log('');
  }
}
