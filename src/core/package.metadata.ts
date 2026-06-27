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
import { walkFiles } from './file.js';
import { replaceTokens, buildTokenMap } from './package.namespace.js';
import { normalizeRepo, downloadDir } from './service.github.js';
import type { MetadataStep } from './package.dependencies.js';

/**
 * Downloads a CCI `unpackaged/pre` or `unpackaged/post` subfolder from GitHub,
 * injects namespace tokens, and deploys it to the target org via `project:deploy:start`.
 */
export async function deployMetadataStep(
  step: MetadataStep,
  targetOrg: string,
  shipDir: string,
  log: (msg: string) => void,
  runCommand: (id: string, argv: string[]) => Promise<unknown>
): Promise<void> {
  const repo = normalizeRepo(step.repoUrl);
  const slug = repo.replace('/', '_');
  const localDir = join(shipDir, 'tmp', 'deps', slug, step.subfolder);

  log(`Downloading ${step.repoUrl}/${step.subfolder}@${step.tag}...`);
  await downloadDir(repo, step.tag, step.subfolder, localDir);

  const files = await walkFiles(localDir);
  await Promise.all(files.map((f) => replaceTokens(f, buildTokenMap(step.namespace))));

  log(`Deploying ${step.subfolder}...`);
  await runCommand('project:deploy:start', ['--metadata-dir', localDir, '--target-org', targetOrg]);
}
