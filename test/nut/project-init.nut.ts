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
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

describe('ship project init (NUT)', () => {
  let session: TestSession;
  let projectDir: string;

  before(async () => {
    // init only scaffolds files (project:generate is offline), so no dev hub is needed.
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
    // init derives the package dir name from the cwd basename, so run it in a fresh subdir.
    projectDir = join(session.dir, 'init-nut');
    mkdirSync(projectDir);

    execCmd(
      'ship project init --name MyPkg --namespace mypkg --package-type Unlocked --repo-url https://github.com/acme/repo',
      { ensureExitCode: 0, cwd: projectDir }
    );
  });

  after(async () => {
    await session?.clean();
  });

  it('patches sfdx-project.json with the package name', () => {
    const sfdxProjectPath = join(projectDir, 'sfdx-project.json');
    assert.ok(existsSync(sfdxProjectPath), 'sfdx-project.json exists');
    const sfdxProject = JSON.parse(readFileSync(sfdxProjectPath, 'utf8')) as {
      packageDirectories: Array<{ package?: string }>;
    };
    assert.equal(sfdxProject.packageDirectories[0].package, 'MyPkg');
  });

  it('writes ship.yml with the provided options', () => {
    const shipYml = readFileSync(join(projectDir, 'ship.yml'), 'utf8');
    assert.ok(shipYml.includes('name: MyPkg'));
    assert.ok(shipYml.includes('namespace: mypkg'));
    assert.ok(shipYml.includes('type: Unlocked'));
  });

  it('writes the .ship/orgs scratch org definitions', () => {
    assert.ok(existsSync(join(projectDir, '.ship', 'orgs', 'dev.json')));
  });

  it('replaces the generated README with the ship template', () => {
    const readme = readFileSync(join(projectDir, 'README.md'), 'utf8');
    assert.ok(readme.includes('# SF Ship Documentation'), 'ship README should replace project:generate boilerplate');
  });

  it('removes the generated config directory', () => {
    assert.equal(existsSync(join(projectDir, 'config')), false);
  });
});
