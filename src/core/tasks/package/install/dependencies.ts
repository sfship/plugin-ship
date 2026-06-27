import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { installDependencies } from '../../../package.installer.js';

export default {
  description:
    'Resolves and installs all dependencies declared in ship.yml in topological order. ' +
    'Package versions already installed in the target org are skipped unless `force` is set.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to install packages into. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      description: 'Minutes to wait per package installation. Defaults to 10.',
    },
    {
      name: 'dry-run',
      type: 'boolean',
      required: false,
      description: 'When true, resolves and logs dependency steps without installing.',
    },
    {
      name: 'force',
      type: 'boolean',
      required: false,
      description: 'Reinstall package versions even if the target org already has them installed.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    await installDependencies(flow.config.project.package?.dependencies ?? [], {
      alias: flow.orgs.resolveAlias(params['target-org'] as string | undefined),
      wait: (params['wait'] as number | undefined) ?? 10,
      dryRun: params['dry-run'] === true,
      force: params['force'] === true,
      shipDir: flow.shipDir,
      log: flow.log,
      runCommand: flow.runCommand,
    });
  },
} satisfies TaskDefinition;
