import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';

export default {
  description: 'Promotes a 2GP package version from beta to released. Passthrough for `sf package version promote`.',
  params: [
    {
      name: 'version-id',
      type: 'string',
      required: true,
      description: '04t SubscriberPackageVersionId or alias of the package version to promote.',
    },
    {
      name: 'target-dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'no-prompt',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Skip the confirmation prompt. Defaults to true so the step never blocks a flow.',
    },
  ],
  outputs: [
    {
      name: 'version-id',
      type: 'string',
      description: 'The 04t SubscriberPackageVersionId of the promoted package version (unchanged from input).',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const versionId = params['version-id'] as string;

    const argv = resolvePassthroughArgs(params, {
      '--package': versionId,
      // sf calls the flag `--package`; our task param is `version-id`. Strip the task-name so it isn't doubled.
      '--version-id': null,
    });

    flow.log(`Promoting ${versionId} to released...`);
    await flow.runCommand('package:version:promote', argv);
    flow.log(`Promoted ${versionId}.`);
    output.set('version-id', versionId);
  },
} satisfies TaskDefinition;
