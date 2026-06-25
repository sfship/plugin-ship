import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';

export default {
  description: 'Deletes a scratch org by alias. Passthrough for `sf org delete scratch`.',
  params: [{ name: 'alias', type: 'string', required: true, description: 'The scratch org alias to delete.' }],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['alias'] as string);
    await flow.runCommand('org:delete:scratch', ['--target-org', alias, '--no-prompt']);
    flow.log(`Deleted scratch org: ${alias}`);
  },
} satisfies TaskDefinition;
