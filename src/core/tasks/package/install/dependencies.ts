import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';
import { resolveDependencies, type DependencyStep } from '@plugin-ship/core/package.resolver.js';
import { deployMetadataStep } from '@plugin-ship/core/package.metadata.js';

function describeStep(step: DependencyStep): string {
  if (step.kind === 'package-id') return `package-id  ${step.versionId}${step.name ? ` (${step.name})` : ''}`;
  return `metadata    ${step.repoUrl}/${step.subfolder}`;
}

export default {
  description: 'Resolves and installs all dependencies declared in ship.yml in topological order.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: true,
      description: 'Org alias or username to install packages into.',
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
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const deps = flow.config.dependencies ?? [];
    if (deps.length === 0) {
      flow.log('No dependencies declared in ship.yml.');
      return;
    }

    flow.log('Resolving dependencies...');
    const steps = await resolveDependencies(deps);

    if (steps.length === 0) {
      flow.log('Dependency tree resolved to zero steps.');
      return;
    }

    flow.log(`Resolved ${steps.length} step(s):`);
    for (const step of steps) {
      flow.log(`  ${describeStep(step)}`);
    }

    if (params['dry-run']) {
      flow.log('dry-run — skipping install.');
      return;
    }

    const alias = flow.orgs.resolveAlias(params['target-org'] as string);
    const wait = (params['wait'] as number | undefined) ?? 10;

    for (const step of steps) {
      if (step.kind === 'package-id') {
        flow.log(`Installing ${step.versionId}${step.name ? ` (${step.name})` : ''}...`);
        // eslint-disable-next-line no-await-in-loop
        await flow.runCommand('package:install', [
          '--package',
          step.versionId,
          '--target-org',
          alias,
          '--wait',
          String(wait),
          '--no-prompt',
        ]);
        flow.log(`Installed ${step.versionId}.`);
      } else if (step.kind === 'metadata') {
        // eslint-disable-next-line no-await-in-loop
        await deployMetadataStep(step, alias, flow.shipDir, flow.log, flow.runCommand);
      } else {
        flow.log(`Skipping ${describeStep(step)} — not yet supported.`);
      }
    }
  },
} satisfies TaskDefinition;
