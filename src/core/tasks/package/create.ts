import type { TaskContext, TaskDefinition } from '../../task.definition.schema.js';
import { resolvePassthroughArgs } from '../../task.param.js';
import { ExpectedError } from '../../error.js';
import { readSfdxProject, writeSfdxProject } from '../../sfdx-project.js';

type PackageCreateResult = {
  Id?: string;
};

export default {
  description:
    'Registers a 2GP managed or unlocked package on the Dev Hub. Passthrough for `sf package create`. Writes the new 0Ho into sfdx-project.json packageAliases. Idempotent: skips if the package is already in packageAliases.',
  params: [
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Display name for the package. Defaults to project.package.name from ship.yml.',
    },
    {
      name: 'package-type',
      type: 'string',
      required: true,
      description: 'Package type: Managed or Unlocked.',
    },
    {
      name: 'path',
      type: 'string',
      required: false,
      default: 'force-app',
      description: 'Path to the package source directory.',
    },
    {
      name: 'description',
      type: 'string',
      required: false,
      description: 'Description of the package.',
    },
    {
      name: 'no-namespace',
      type: 'boolean',
      required: false,
      description: 'Create the package as no-namespace.',
    },
    {
      name: 'target-dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'org-dependent',
      type: 'boolean',
      required: false,
      description: 'Mark as org-dependent. Only valid for Unlocked package types.',
    },
    {
      name: 'error-notification-username',
      type: 'string',
      required: false,
      description: 'Username to receive package upload failure notifications.',
    },
  ],
  outputs: [
    {
      name: 'package-id',
      type: 'string',
      description: 'The 0Ho Package2Id of the created (or already-registered) package.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const name = (params['name'] as string | undefined) ?? flow.config.project.package?.name;
    if (!name) {
      throw new ExpectedError('No package name. Pass `name` param or set project.package.name in ship.yml.');
    }

    const existing = readSfdxProject(flow.projectDir).packageAliases ?? {};
    if (existing[name]) {
      flow.log(`Package "${name}" already registered as ${existing[name]} — skipping.`);
      output.set('package-id', existing[name]);
      return;
    }

    const argv = resolvePassthroughArgs(params, {
      '--name': name,
    });

    // Disable sf's sfdx-project.json autoupdate. We write the alias ourselves below.
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_env_variables.htm
    process.env.SF_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_CREATE = 'true';

    flow.log(`Creating package "${name}"...`);
    const result = (await flow.runCommand('package:create', argv)) as PackageCreateResult;

    if (!result.Id) {
      throw new ExpectedError('Package create completed without a Package2Id.');
    }

    const sfdxProject = readSfdxProject(flow.projectDir);
    sfdxProject.packageAliases = { ...sfdxProject.packageAliases, [name]: result.Id };
    writeSfdxProject(flow.projectDir, sfdxProject);

    flow.log(`Created package ${result.Id} and wrote alias "${name}" to sfdx-project.json.`);
    output.set('package-id', result.Id);
  },
} satisfies TaskDefinition;
