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

/* eslint-disable camelcase */
import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../../mock-command.js';

const deviceData = {
  verification_uri: 'https://github.com/login/device',
  user_code: 'ABCD-1234',
  device_code: 'device-code-abc',
  interval: 5,
};

let capturedToken: string | undefined;
let capturedLogin: string | undefined;
let capturedAlias: string | undefined;
let capturedScopes: string[] | undefined;

const ServiceConnectGithub = await mockCommand('ship/service/connect/github.js', {
  'service.github.js': {
    requestDeviceCode: async () => deviceData,
    pollForToken: async (deviceCode: string) => `token-for-${deviceCode}`,
    fetchGithubUser: async () => ({ user: { login: 'testuser' }, scopes: ['repo', 'user'] }),
    setGithubToken: (token: string, login: string, alias: string, scopes: string[]) => {
      capturedToken = token;
      capturedLogin = login;
      capturedAlias = alias;
      capturedScopes = scopes;
    },
  },
  '@oclif/core': {
    ux: { action: { start() {}, stop() {} } },
  },
});

describe('ship service connect github', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    capturedToken = undefined;
    capturedLogin = undefined;
    capturedAlias = undefined;
    capturedScopes = undefined;
  });

  it('shows the Service Connect: GitHub header', async () => {
    await ServiceConnectGithub.run([]);
    assert.ok(stubs.styledHeader.calledWith('Service Connect: GitHub'));
  });

  it('stores the token returned by pollForToken', async () => {
    await ServiceConnectGithub.run([]);
    assert.equal(capturedToken, `token-for-${deviceData.device_code}`);
  });

  it('stores the github username and alias', async () => {
    await ServiceConnectGithub.run(['--alias', 'work']);
    assert.equal(capturedLogin, 'testuser');
    assert.equal(capturedAlias, 'work');
  });

  it('parses and stores the oauth scopes', async () => {
    await ServiceConnectGithub.run([]);
    assert.deepEqual(capturedScopes, ['repo', 'user']);
  });

  it('logs a success message with the github username', async () => {
    await ServiceConnectGithub.run([]);
    const success = stubs.log.args.find(([a]) => String(a ?? '').includes('Connected to Github as'));
    assert.ok(success, 'expected a log call with the success message');
    assert.ok(String(success[0]).includes('testuser'));
  });
});
