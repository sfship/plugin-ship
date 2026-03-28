import { resolve } from 'node:path';
import { ComponentSetBuilder, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import { Task, TaskContext } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

export default new (class MetadataDeploy extends Task {
  public readonly name = 'metadata/deploy';
  public readonly description = 'Deploys metadata to a target org using the Salesforce source deploy API.';
  public readonly params: ParamDefinition[] = [
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
  ];

  // eslint-disable-next-line class-methods-use-this
  public async run({ flow, params }: TaskContext): Promise<void> {
    const sourceDir = resolve(process.cwd(), (params['source-dir'] as string | undefined) ?? 'force-app');
    const alias = params['target-org'] as string;

    const componentSet = await ComponentSetBuilder.build({ sourcepath: [sourceDir] });
    const deploy = await componentSet.deploy({ usernameOrConnection: alias });

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
        .map((f) => `  ${f.filePath}: ${'error' in f ? f.error : ''}`)
        .join('\n');
      throw new Error(`Deployment failed:\n${failures}`);
    }

    flow.log(`Deployed ${result.response.numberComponentsDeployed} components successfully.`);
  }
})();
