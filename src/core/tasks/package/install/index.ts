import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';

export default {
  description: 'Installs a package version into a Salesforce org. Passthrough for `sf package install`.',
  params: [
    {
      name: 'version-id',
      type: 'string',
      required: true,
      description: 'The 04t package version ID to install.',
    },
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to install the package into. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      default: 10,
      description: 'Minutes to wait for installation to complete. Defaults to 10.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const versionId = params['version-id'] as string;
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const argv = resolvePassthroughArgs(params, {
      '--target-org': alias ?? null,
      '--package': versionId,
      '--version-id': null,
    });
    await flow.runCommand('package:install', argv);
    flow.log(`Package ${versionId} installed successfully.`);
  },
} satisfies TaskDefinition;
