import { join } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';
import { ExpectedError } from '../../../error.js';
import { withSuppressedStdout } from '../../../stdout.js';

type DeployFile = {
  fullName: string;
  type: string;
  state: string;
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  error?: string;
};

type DeployResult = {
  success: boolean;
  files: DeployFile[];
};

export default {
  description: 'Deploys metadata to a target org. Passthrough for `sf project deploy start`.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to deploy to. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'source-dir',
      type: 'string',
      required: false,
      description: 'Path to local source files to deploy. Defaults to "force-app".',
    },
    {
      name: 'manifest',
      type: 'string',
      required: false,
      description: 'Full file path for manifest (package.xml) of components to deploy.',
    },
    {
      name: 'metadata',
      type: 'string',
      required: false,
      description: 'Metadata component names to deploy.',
    },
    {
      name: 'metadata-dir',
      type: 'string',
      required: false,
      description: 'Root of directory or zip file of metadata formatted files to deploy.',
    },
    {
      name: 'ignore-conflicts',
      type: 'boolean',
      required: false,
      description: 'Ignore conflicts and deploy local files, even if they overwrite changes in the org.',
    },
    {
      name: 'ignore-warnings',
      type: 'boolean',
      required: false,
      description: 'Ignore warnings and allow a deployment to complete successfully.',
    },
    {
      name: 'dry-run',
      type: 'boolean',
      required: false,
      description: "Validate deploy and run Apex tests but don't save to the org.",
    },
    {
      name: 'test-level',
      type: 'string',
      required: false,
      description:
        'Deployment Apex testing level: NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg, RunRelevantTests.',
    },
    {
      name: 'tests',
      type: 'string',
      required: false,
      description: 'Apex tests to run when --test-level is RunSpecifiedTests.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      description: 'Minutes to wait for the command to complete. Defaults to 33.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const argv = resolvePassthroughArgs(params, {
      '--target-org': alias ?? null,
      '--source-dir': join(flow.projectDir, (params['source-dir'] as string | undefined) ?? 'force-app'),
    });

    let result: DeployResult;
    try {
      result = await withSuppressedStdout(() => flow.runCommand('project:deploy:start', argv) as Promise<DeployResult>);
    } catch (err) {
      if (err instanceof ExpectedError && err.message.includes('No local changes to deploy')) {
        flow.log('Nothing to deploy — skipping.');
        return;
      }
      throw err;
    }

    if (!result.success) {
      const failed = result.files.filter((f) => f.state === 'Failed');
      const lines = failed.map((f) => {
        const loc =
          f.lineNumber !== undefined && f.columnNumber !== undefined ? ` (${f.lineNumber}:${f.columnNumber})` : '';
        return `  ${f.filePath}${loc}: ${f.error ?? ''}`;
      });
      throw new ExpectedError(`Deploy failed:\n${lines.join('\n')}`);
    }
    flow.log('Deployed successfully.');
  },
} satisfies TaskDefinition;
