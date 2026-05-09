import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';
import { installPackageVersion } from '@plugin-ship/core/package.installer.js';

export default {
  description: 'Installs a package version into a Salesforce org.',
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
      required: true,
      description: 'Org alias or username to install the package into.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      description: 'Minutes to wait for installation to complete. Defaults to 10.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const versionId = params['version-id'] as string;
    const targetOrg = params['target-org'] as string;
    const waitMinutes = (params['wait'] as number | undefined) ?? 10;

    const org = await flow.orgs.getOrg(targetOrg);
    await installPackageVersion(org, versionId, { waitMinutes, log: flow.log });
  },
} satisfies TaskDefinition;
