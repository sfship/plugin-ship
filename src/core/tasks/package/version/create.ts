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
import { resolvePassthroughArgs } from '../../../task.param.js';
import { ExpectedError } from '../../../error.js';
import { defaultPackageAlias } from '../../../sfdx-project.js';
import { formatVersionNumber, type PackageVersionCreateResult } from '../../../package.version.js';

export default {
  description:
    'Creates a managed package version. Passthrough for `sf package version create`. Waits for completion so the resulting version ID is available to subsequent steps.',
  params: [
    {
      name: 'package',
      type: 'string',
      required: false,
      description:
        'Package ID (0Ho), or alias from sfdx-project.json packageAliases. Defaults to the default package directory in sfdx-project.json.',
    },
    {
      name: 'target-dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      description: 'Minutes to wait for the version create to complete. Defaults to 60.',
    },
    {
      name: 'code-coverage',
      type: 'boolean',
      required: false,
      description: 'Calculate and store code coverage info for Apex classes and triggers.',
    },
    {
      name: 'skip-validation',
      type: 'boolean',
      required: false,
      description:
        'Skip validation during package version creation. Speeds up beta builds; not allowed for promotable versions.',
    },
    {
      name: 'installation-key',
      type: 'string',
      required: false,
      description: 'Installation key for key-protected package versions.',
    },
    {
      name: 'installation-key-bypass',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Bypass the installation key requirement.',
    },
    {
      name: 'version-number',
      type: 'string',
      required: false,
      description: 'Override the version number in sfdx-project.json (e.g. 1.2.0.NEXT).',
    },
    {
      name: 'version-name',
      type: 'string',
      required: false,
      description: 'Human-readable version name.',
    },
    {
      name: 'branch',
      type: 'string',
      required: false,
      description: 'Branch name to associate with the package version.',
    },
    {
      name: 'tag',
      type: 'string',
      required: false,
      description: 'Tag to associate with the package version.',
    },
    {
      name: 'path',
      type: 'string',
      required: false,
      description: 'Path to the package directory. Defaults to the default package directory in sfdx-project.json.',
    },
  ],
  outputs: [
    {
      name: 'version-id',
      type: 'string',
      description: 'The 04t SubscriberPackageVersionId of the created package version.',
    },
    {
      name: 'package-version-id',
      type: 'string',
      description: 'The 05i Package2VersionId of the created package version (used by package/version/promote).',
    },
    {
      name: 'version-number',
      type: 'string',
      description: 'The resolved version number assigned to the created package version (e.g. "0.2.0.1").',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const wait = (params['wait'] as number | undefined) ?? 60;

    const overrides: Record<string, string | null> = {
      '--wait': String(wait),
    };

    // sf package version create requires --package or --path explicitly; it does NOT
    // auto-fall-back to the default packageDirectory. Do that fallback ourselves by
    // reading the default packageDirectory's package alias from sfdx-project.json.
    if (!params['package'] && !params['path']) {
      const defaultPackage = defaultPackageAlias(flow.projectDir);
      if (defaultPackage) overrides['--package'] = defaultPackage;
    }

    const argv = resolvePassthroughArgs(params, overrides);

    // Prevent sf from writing to sfdx-project.json
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_env_variables.htm
    process.env.SF_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_VERSION_CREATE = 'true';

    const label = (params['package'] as string | undefined) ?? overrides['--package'] ?? '(default package)';
    flow.log(`Creating package version for ${label}...`);
    const result = (await flow.runCommand('package:version:create', argv)) as PackageVersionCreateResult;

    if (!result.SubscriberPackageVersionId) {
      throw new ExpectedError(
        `Package version create completed without a SubscriberPackageVersionId (status: ${result.Status ?? 'unknown'}).`
      );
    }

    const versionNumber = formatVersionNumber(result);

    flow.log(
      `Created ${result.SubscriberPackageVersionId}${versionNumber ? ` (${versionNumber})` : ''} (status: ${
        result.Status ?? 'Success'
      })`
    );
    output.set('version-id', result.SubscriberPackageVersionId);
    if (result.Package2VersionId) {
      output.set('package-version-id', result.Package2VersionId);
    }
    if (versionNumber) {
      output.set('version-number', versionNumber);
    }
  },
} satisfies TaskDefinition;
