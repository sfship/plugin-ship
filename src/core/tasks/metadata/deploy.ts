import { resolve } from 'node:path';
import { ComponentSetBuilder, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';
import { ExpectedError } from '@plugin-ship/core/util.error.js';

export default {
  description: 'Deploys metadata to a target org using the Salesforce source deploy API.',
  params: [
    {
      name: 'source-dir',
      type: 'string',
      required: false,
      description: 'Path to the source directory to deploy. Defaults to "force-app".',
    },
    {
      name: 'target-org',
      type: 'string',
      required: true,
      description: 'Org alias or username to deploy to.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const sourceDir = resolve(process.cwd(), (params['source-dir'] as string | undefined) ?? 'force-app');
    const alias = params['target-org'] as string;

    const org = await flow.orgs.getOrg(alias);
    const componentSet = await ComponentSetBuilder.build({ sourcepath: [sourceDir] });
    const deploy = await componentSet.deploy({ usernameOrConnection: org.getUsername() ?? alias });

    deploy.onUpdate((status) => {
      flow.log(
        `Deploy ${status.status}: ${status.numberComponentsDeployed}/${status.numberComponentsTotal} components`
      );
    });

    const result = await deploy.pollStatus();

    if (!result.response.success) {
      const failures = result
        .getFileResponses()
        .filter((f) => f.state === ComponentStatus.Failed)
        .map((f) => `  ${f.filePath ?? '(unknown)'}: ${'error' in f ? f.error : ''}`)
        .join('\n');
      throw new ExpectedError(`Deployment failed:\n${failures}`);
    }

    flow.log(`Deployed ${result.response.numberComponentsDeployed} components successfully.`);
  },
} satisfies TaskDefinition;
