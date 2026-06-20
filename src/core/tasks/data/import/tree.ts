import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { resolvePassthroughArgs } from '../../../task.param.js';

export default {
  description: 'Imports records into an org from tree/plan files. Passthrough for `sf data import tree`.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to import records into. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'plan',
      type: 'string',
      required: false,
      description: 'Path to a plan file describing the ordered tree of records to import.',
    },
    {
      name: 'files',
      type: 'string',
      required: false,
      description: 'Comma-separated tree JSON files to import. Alternative to `plan`.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    if (!params['plan'] && !params['files']) {
      flow.log('No plan or files configured — skipping data import.');
      return;
    }
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const argv = resolvePassthroughArgs(params, { '--target-org': alias ?? null });
    await flow.runCommand('data:import:tree', argv);
    flow.log('Imported records.');
  },
} satisfies TaskDefinition;
