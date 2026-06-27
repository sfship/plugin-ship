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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists, ensureDir, readText, writeText, writeJson, appendText, removeFile } from './file.js';

const templateDir = join(fileURLToPath(import.meta.url), '..', 'templates');

export type InitOptions = {
  packageName: string;
  namespace?: string;
  packageType: 'Managed' | 'Unlocked';
  repoUrl?: string;
};

export type InitResult = {
  created: string[];
  skipped: string[];
};

function writeIfAbsent(absPath: string, relPath: string, content: string, result: InitResult): void {
  if (fileExists(absPath)) {
    result.skipped.push(relPath);
    return;
  }
  writeText(absPath, content);
  result.created.push(relPath);
}

function buildShipYml({ packageName, namespace, packageType, repoUrl }: InitOptions): string {
  const lines = ['project:', '  package:', `    name: ${packageName}`];
  if (namespace) lines.push(`    namespace: ${namespace}`);
  lines.push(`    type: ${packageType}`);
  lines.push('  git:', '    defaultBranch: main');
  if (repoUrl) lines.push(`    repoUrl: ${repoUrl}`);
  return lines.join('\n') + '\n';
}

function patchSfdxProjectJson(projectDir: string, { packageName, namespace, packageType }: InitOptions): void {
  const filePath = join(projectDir, 'sfdx-project.json');
  if (!fileExists(filePath)) return;

  const raw = JSON.parse(readText(filePath)) as {
    [key: string]: unknown;
    packageDirectories: Array<Record<string, unknown>>;
    namespace?: string;
  };

  const defaultDir = raw.packageDirectories.find((d) => d.default) ?? raw.packageDirectories[0];
  if (defaultDir) {
    defaultDir.package = packageName;
    defaultDir.versionName = 'ver 0.1';
    defaultDir.versionNumber = '0.0.0.NEXT';
    if (packageType === 'Managed') {
      defaultDir.ancestorVersion = 'HIGHEST';
    }
  }

  if (namespace) {
    raw.namespace = namespace;
  }

  writeJson(filePath, raw);
}

function appendToGitignore(projectDir: string): void {
  const filePath = join(projectDir, '.gitignore');
  const entry = '\n# sf-ship\n.ship/tmp/\n';
  const existing = fileExists(filePath) ? readText(filePath) : '';
  if (!existing.includes('.ship/tmp/')) {
    appendText(filePath, entry);
  }
}

function appendToForceignore(projectDir: string): void {
  const filePath = join(projectDir, '.forceignore');
  const entry = [
    '',
    '# sf-ship',
    '**/*.profile-meta.xml',
    '**/*.appMenu-meta.xml',
    '**/sfdcInternalInt__*.permissionset-meta.xml',
    '',
  ].join('\n');
  const existing = fileExists(filePath) ? readText(filePath) : '';
  if (!existing.includes('# sf-ship')) {
    appendText(filePath, entry);
  }
}

const commonSettings = {
  lightningExperienceSettings: { enableS1DesktopEnabled: true },
  securitySettings: {
    enableAdminLoginAsAnyUser: true,
    sessionSettings: { forceRelogin: false },
  },
};

function buildOrgDefs(packageName: string): Record<string, object> {
  const label = (env: string): string => `${packageName}:${env}`;
  return {
    dev: {
      orgName: label('dev'),
      edition: 'Developer',
      hasSampleData: true,
      settings: {
        ...commonSettings,
        userManagementSettings: { permsetsInFieldCreation: true, enableEnhancedPermsetMgmt: true },
      },
    },
    feature: { orgName: label('feature'), edition: 'Developer', settings: commonSettings },
    beta: { orgName: label('beta'), edition: 'Developer', settings: commonSettings },
    qa: { orgName: label('qa'), edition: 'Enterprise', hasSampleData: true, settings: commonSettings },
    regression: { orgName: label('regression'), edition: 'Enterprise', settings: commonSettings },
    release: { orgName: label('release'), edition: 'Enterprise', settings: commonSettings },
  };
}

export function initProject(options: InitOptions, projectDir: string): InitResult {
  const result: InitResult = { created: [], skipped: [] };

  const orgsDir = join(projectDir, '.ship', 'orgs');
  ensureDir(orgsDir);

  patchSfdxProjectJson(projectDir, options);
  appendToGitignore(projectDir);
  appendToForceignore(projectDir);
  writeIfAbsent(join(projectDir, 'README.md'), 'README.md', readText(join(templateDir, 'README.md')), result);
  const legacyConfigDir = join(projectDir, 'config');
  if (fileExists(legacyConfigDir)) removeFile(legacyConfigDir);
  writeIfAbsent(join(projectDir, 'ship.yml'), 'ship.yml', buildShipYml(options), result);

  for (const [name, def] of Object.entries(buildOrgDefs(options.packageName))) {
    writeIfAbsent(
      join(orgsDir, `${name}.json`),
      `.ship/orgs/${name}.json`,
      JSON.stringify(def, null, 4) + '\n',
      result
    );
  }

  return result;
}
