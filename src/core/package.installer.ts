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
import type { ShipDependency } from './config.dependency.schema.js';
import { resolveDependencies, type DependencyStep } from './package.dependencies.js';
import { deployMetadataStep } from './package.metadata.js';
import { withSuppressedStdout } from './stdout.js';

export function describeStep(step: DependencyStep): string {
  if (step.kind === 'package-id') return `package-id  ${step.versionId}${step.name ? ` (${step.name})` : ''}`;
  return `metadata    ${step.repoUrl}/${step.subfolder}`;
}

export type InstallDependenciesOptions = {
  alias: string | undefined;
  wait: number;
  dryRun: boolean;
  force: boolean;
  shipDir: string;
  log: (msg: string) => void;
  runCommand: (id: string, argv: string[]) => Promise<unknown>;
};

export async function installDependencies(deps: ShipDependency[], options: InstallDependenciesOptions): Promise<void> {
  const { alias, wait, dryRun, force, shipDir, log, runCommand } = options;

  if (deps.length === 0) {
    log('No dependencies declared in ship.yml.');
    return;
  }

  log('Resolving dependencies...');
  const steps = await resolveDependencies(deps);

  if (steps.length === 0) {
    log('Dependency tree resolved to zero steps.');
    return;
  }

  log(`Resolved ${steps.length} step(s):`);
  for (const step of steps) {
    log(`  ${describeStep(step)}`);
  }

  if (dryRun) {
    log('dry-run — skipping install.');
    return;
  }

  let installed = new Set<string>();
  if (!force) {
    const listArgs = ['--json', ...(alias !== undefined ? ['--target-org', alias] : [])];
    const result = (await withSuppressedStdout(() => runCommand('package:installed:list', listArgs))) as Array<{
      SubscriberPackageVersionId: string;
    }>;
    installed = new Set(result.map((p) => p.SubscriberPackageVersionId));
    log(`${installed.size} package version(s) already installed in ${alias ?? 'default org'}.`);
  }

  for (const step of steps) {
    if (step.kind === 'package-id') {
      if (installed.has(step.versionId)) {
        log(`Already installed: ${step.versionId}${step.name ? ` (${step.name})` : ''} — skipping.`);
        continue;
      }
      log(`Installing ${step.versionId}${step.name ? ` (${step.name})` : ''}...`);
      const installArgs = ['--package', step.versionId, '--wait', String(wait), '--no-prompt'];
      if (alias !== undefined) installArgs.push('--target-org', alias);
      // eslint-disable-next-line no-await-in-loop
      await runCommand('package:install', installArgs);
      log(`Installed ${step.versionId}.`);
    } else {
      if (installed.has(step.versionId)) {
        log(`Already installed (${step.versionId}): ${step.repoUrl}/${step.subfolder} — skipping.`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await deployMetadataStep(step, alias ?? '', shipDir, log, runCommand);
    }
  }
}
