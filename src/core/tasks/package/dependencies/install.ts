import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';
import { resolveDependencies, type DependencyStep } from '@plugin-ship/core/dependency.resolver.js';

function describeStep(step: DependencyStep): string {
  if (step.kind === 'package-id') return `package-id  ${step.versionId}${step.name ? ` (${step.name})` : ''}`;
  if (step.kind === 'package-namespace') return `namespace   ${step.namespace} ${step.version}`;
  return `metadata    ${step.repoUrl}/${step.subfolder}${step.unmanaged ? ' [unmanaged]' : ''}`;
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

    // TODO: implement package/install calls per step
    flow.log('Install not yet implemented — use dry-run to inspect the resolved steps.');
  },
} satisfies TaskDefinition;
