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
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';
import { withSuppressedStdout } from '../../../stdout.js';
import { selectLatest, extractVersionBase, type PackageVersion } from '../../../package.version.js';

export default {
  description:
    'Resolves the latest package version ID for the project package. Passthrough for `sf package version list`.',
  params: [
    {
      name: 'package',
      type: 'string',
      required: false,
      description: 'Package name, ID, or alias to look up. Defaults to the project package from ship.yml.',
    },
    {
      name: 'target-dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'released',
      type: 'boolean',
      required: false,
      default: false,
      description:
        'When true, resolve the latest released version. When false (default), the latest unreleased (beta).',
    },
    {
      name: 'branch',
      type: 'string',
      required: false,
      description: 'Filter to versions built from a specific branch.',
    },
  ],
  outputs: [
    {
      name: 'version-id',
      type: 'string',
      description: 'The 04t SubscriberPackageVersionId of the latest matching package version.',
    },
    {
      name: 'version-number',
      type: 'string',
      description: 'Full version number including build (e.g. "0.1.0.4").',
    },
    {
      name: 'version-base',
      type: 'string',
      description: 'Major.minor.patch portion only (e.g. "0.1.0"), useful for production release tags.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const packageName = (params['package'] as string | undefined) ?? flow.config.project.package?.name;
    if (!packageName) {
      throw new ExpectedError('No package specified. Pass `package` param or set project.package.name in ship.yml.');
    }

    const argv: string[] = ['--packages', packageName, '--json'];
    if (params['target-dev-hub']) argv.push('--target-dev-hub', params['target-dev-hub'] as string);
    if (params['branch']) argv.push('--branch', params['branch'] as string);
    const wantReleased = params['released'] === true;
    if (wantReleased) argv.push('--released');

    const versions = (await withSuppressedStdout(() =>
      flow.runCommand('package:version:list', argv)
    )) as PackageVersion[];

    const latest = selectLatest(versions, wantReleased);

    if (!latest) {
      throw new ExpectedError(
        `No ${wantReleased ? 'released' : 'unreleased'} versions found for package "${packageName}".`
      );
    }

    flow.log(
      `Resolved ${packageName} → ${latest.Version ?? '(unknown version)'} (${latest.SubscriberPackageVersionId})${
        wantReleased ? ' [released]' : ' [beta]'
      }`
    );
    output.set('version-id', latest.SubscriberPackageVersionId);
    if (latest.Version) {
      output.set('version-number', latest.Version);
      const base = extractVersionBase(latest.Version);
      if (base) output.set('version-base', base);
    }
  },
} satisfies TaskDefinition;
