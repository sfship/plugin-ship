import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';
import { ExpectedError } from '../../../util.error.js';
import { normalizeSfdxProject } from '../../../util.sfdx-project.js';

/** Reads sfdx-project.json and returns the package alias of the default packageDirectory, if any. */
async function getDefaultPackageAlias(projectDir: string): Promise<string | null> {
  try {
    const raw = await readFile(join(projectDir, 'sfdx-project.json'), 'utf8');
    const parsed = JSON.parse(raw) as { packageDirectories?: Array<{ default?: boolean; package?: string }> };
    const defaultDir = parsed.packageDirectories?.find((d) => d.default) ?? parsed.packageDirectories?.[0];
    return defaultDir?.package ?? null;
  } catch {
    return null;
  }
}

type PackageVersionCreateResult = {
  Id?: string;
  Status?: string;
  Package2Id?: string;
  Package2VersionId?: string;
  SubscriberPackageVersionId?: string;
  Branch?: string | null;
  Tag?: string | null;
  MajorVersion?: number;
  MinorVersion?: number;
  PatchVersion?: number;
  BuildNumber?: number;
  VersionNumber?: string;
};

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
      const defaultPackage = await getDefaultPackageAlias(flow.projectDir);
      if (defaultPackage) overrides['--package'] = defaultPackage;
    }

    const argv = resolvePassthroughArgs(params, overrides);

    const label = (params['package'] as string | undefined) ?? overrides['--package'] ?? '(default package)';
    flow.log(`Creating package version for ${label}...`);
    const result = (await flow.runCommand('package:version:create', argv)) as PackageVersionCreateResult;

    if (!result.SubscriberPackageVersionId) {
      throw new ExpectedError(
        `Package version create completed without a SubscriberPackageVersionId (status: ${result.Status ?? 'unknown'}).`
      );
    }

    const versionNumber =
      result.VersionNumber ??
      (result.MajorVersion !== undefined
        ? `${result.MajorVersion}.${result.MinorVersion ?? 0}.${result.PatchVersion ?? 0}.${result.BuildNumber ?? 0}`
        : undefined);

    await normalizeSfdxProject(flow.projectDir);

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
