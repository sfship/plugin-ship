import { resolve } from 'node:path';
import { ComponentSetBuilder, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import { defineAction } from '../define-action.js';

export default defineAction(async ({ cwd, get, params, log }) => {
  const sourceDir = resolve(cwd, String(params['source-dir'] ?? 'force-app'));
  const alias = String(get('targetOrg') ?? params['target-org'] ?? '');
  if (!alias)
    throw new Error('No target org for deployment. Set targetOrg via a prior step or pass --param target-org=<alias>.');
  const componentSet = await ComponentSetBuilder.build({ sourcepath: [sourceDir] });
  const deploy = await componentSet.deploy({ usernameOrConnection: alias });

  deploy.onUpdate((status) => {
    log(`Deploy ${status.status}: ${status.numberComponentsDeployed}/${status.numberComponentsTotal} components`);
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

  log(`Deployed ${result.response.numberComponentsDeployed} components successfully.`);
});
