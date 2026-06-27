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
import { ux } from '@oclif/core';
import { SfCommand, Flags, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { setGithubToken, requestDeviceCode, pollForToken, fetchGithubUser } from '../../../../core/service.github.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'service.connect.github');

/** Connects a GitHub account via OAuth device flow. */
export default class ServiceConnectGithub extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;

  public static readonly flags = {
    alias: Flags.string({ summary: messages.getMessage('flags.alias.summary'), default: 'default' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ServiceConnectGithub);
    const deviceData = await requestDeviceCode();

    this.log('');
    this.styledHeader('Service Connect: GitHub');
    this.log(`Go to: \x1b[36m${deviceData.verification_uri}\x1b[0m`);
    this.log(`Code:  ${StandardColors.success(deviceData.user_code)}\n`);

    ux.action.start('Waiting for authorization');
    const token = await pollForToken(deviceData.device_code, deviceData.interval * 1000);
    ux.action.stop();

    const { user, scopes } = await fetchGithubUser(token);
    setGithubToken(token, user.login, flags.alias, scopes);
    this.log('');
    this.log(StandardColors.success('✓') + ' Connected to Github as ' + StandardColors.success(user.login));
    this.log(`Scopes: ${scopes.join(', ')}`);
    this.log('');
  }
}
