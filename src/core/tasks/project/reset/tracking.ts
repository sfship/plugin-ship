import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';

export default {
  description: 'Resets local and remote source tracking for an org. Passthrough for `sf project reset tracking`.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: true,
      description: 'Org alias or username to reset source tracking for.',
    },
    {
      name: 'revision',
      type: 'number',
      required: false,
      description: 'SourceMember revision counter number to reset tracking to. Defaults to the latest.',
    },
    {
      name: 'no-prompt',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Skip the confirmation prompt. Defaults to true so the step never blocks a flow.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string);
    const argv = resolvePassthroughArgs(params, { '--target-org': alias });
    await flow.runCommand('project:reset:tracking', argv);
    flow.log(`Reset source tracking for ${alias}.`);
  },
} satisfies TaskDefinition;
