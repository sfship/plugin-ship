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
