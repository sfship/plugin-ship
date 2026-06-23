import { resolve } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { resolvePassthroughArgs } from '../../../task.param.js';
import { pathExists } from '../../../file.js';

/** Conventional plan file imported when neither `plan` nor `files` is given. */
const DEFAULT_PLAN = 'data/plan.json';

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
      description:
        'Path to a plan file describing the ordered tree of records to import. Defaults to `.ship/data/plan.json` if present; otherwise the import is skipped.',
    },
    {
      name: 'files',
      type: 'string',
      required: false,
      description: 'Comma-separated tree JSON files to import. Alternative to `plan`.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const overrides: Record<string, string | null> = {};

    // Explicit plan/files win. Otherwise fall back to the conventional
    // `.ship/data/plan.json`; if a project hasn't created one, there's nothing
    // to import, so skip rather than fail.
    if (!params['plan'] && !params['files']) {
      const defaultPlan = resolve(flow.shipDir, DEFAULT_PLAN);
      if (!pathExists(defaultPlan, 'file')) {
        flow.log(`No plan or files configured and no ${DEFAULT_PLAN} found — skipping data import.`);
        return;
      }
      overrides['--plan'] = defaultPlan;
      flow.log(`Importing records from ${defaultPlan}.`);
    }

    overrides['--target-org'] = flow.orgs.resolveAlias(params['target-org'] as string | undefined) ?? null;
    const argv = resolvePassthroughArgs(params, overrides);
    await flow.runCommand('data:import:tree', argv);
    flow.log('Imported records.');
  },
} satisfies TaskDefinition;
