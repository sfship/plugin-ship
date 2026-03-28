import { Org } from '@salesforce/core';
import { Task, TaskContext } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

export default new (class OrgScratchDelete extends Task {
  public readonly name = 'org/scratch/delete';
  public readonly description = 'Deletes a scratch org by alias.';
  public readonly params: ParamDefinition[] = [
    { name: 'alias', type: 'string', required: true, description: 'The scratch org alias to delete.' },
  ];

  // eslint-disable-next-line class-methods-use-this
  public async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['alias'] as string);
    const scratchOrg = await Org.create({ aliasOrUsername: alias });
    await scratchOrg.delete();
    flow.log(`Deleted scratch org: ${alias}`);
  }
})();
