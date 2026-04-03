import { Org } from '@salesforce/core';
import type { Task, TaskContext } from '@plugin-ship/core/task.js';

export default {
  name: 'org/scratch/delete',
  description: 'Deletes a scratch org by alias.',
  params: [{ name: 'alias', type: 'string', required: true, description: 'The scratch org alias to delete.' }],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['alias'] as string);
    const scratchOrg = await Org.create({ aliasOrUsername: alias });
    await scratchOrg.delete();
    flow.log(`Deleted scratch org: ${alias}`);
  },
} satisfies Task;
