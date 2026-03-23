import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { setGithubToken } from '@plugin-ship/core/services/github.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'service.connect.github');

const CLIENT_ID = 'Ov23liy9NAepXOSybR7K';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const SCOPE = 'repo';

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type TokenPollResponse = {
  access_token?: string;
  error?: string;
  interval?: number;
};

type GithubUser = {
  login: string;
};

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const resp = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    // eslint-disable-next-line camelcase
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });
  return resp.json() as Promise<DeviceCodeResponse>;
}

async function pollForToken(deviceCode: string, interval: number): Promise<string> {
  await new Promise<void>((res) => setTimeout(res, interval));
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // eslint-disable-next-line camelcase
      client_id: CLIENT_ID,
      // eslint-disable-next-line camelcase
      device_code: deviceCode,
      // eslint-disable-next-line camelcase
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  const data = (await resp.json()) as TokenPollResponse;
  if (data.access_token) return data.access_token;
  if (data.error === 'slow_down') return pollForToken(deviceCode, (data.interval ?? interval / 1000 + 5) * 1000);
  if (data.error === 'authorization_pending') return pollForToken(deviceCode, interval);
  throw new Error(`GitHub authorization failed: ${data.error ?? 'unknown error'}`);
}

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

    this.log(`\nOpen ${deviceData.verification_uri} in your browser and enter the code:\n`);
    this.log(`  ${deviceData.user_code}\n`);
    this.log('Waiting for authorization...');

    const token = await pollForToken(deviceData.device_code, deviceData.interval * 1000);

    const userResp = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'plugin-ship' },
    });
    const user = (await userResp.json()) as GithubUser;
    const scopes = (userResp.headers.get('x-oauth-scopes') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setGithubToken(token, user.login, flags.alias, scopes);
    this.log(`\nConnected as ${user.login}${flags.alias !== 'default' ? ` (alias: ${flags.alias})` : ''}`);
    this.log(`Scopes: ${scopes.join(', ')}`);
  }
}
