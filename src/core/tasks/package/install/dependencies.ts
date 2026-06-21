import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { resolveDependencies, type DependencyStep } from '../../../package.dependencies.js';
import { deployMetadataStep } from '../../../package.metadata.js';
import { withSuppressedStdout } from '../../../stdout.js';

function describeStep(step: DependencyStep): string {
  if (step.kind === 'package-id') return `package-id  ${step.versionId}${step.name ? ` (${step.name})` : ''}`;
  return `metadata    ${step.repoUrl}/${step.subfolder}`;
}

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
    const deps = flow.config.project.package?.dependencies ?? [];
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

    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const wait = (params['wait'] as number | undefined) ?? 10;

    // Skip anything the org already has. Every step carries the 04t of its
    // release — direct package installs and the unpackaged bundles that ship with
    // a release alike — so one `package installed list` query covers them all.
    let installed = new Set<string>();
    if (params['force'] !== true) {
      const listArgs = ['--json', ...(alias !== undefined ? ['--target-org', alias] : [])];
      const result = (await withSuppressedStdout(() => flow.runCommand('package:installed:list', listArgs))) as Array<{
        SubscriberPackageVersionId: string;
      }>;
      installed = new Set(result.map((p) => p.SubscriberPackageVersionId));
      flow.log(`${installed.size} package version(s) already installed in ${alias ?? 'default org'}.`);
    }

    for (const step of steps) {
      if (step.kind === 'package-id') {
        if (installed.has(step.versionId)) {
          flow.log(`Already installed: ${step.versionId}${step.name ? ` (${step.name})` : ''} — skipping.`);
          continue;
        }
        flow.log(`Installing ${step.versionId}${step.name ? ` (${step.name})` : ''}...`);
        const installArgs = ['--package', step.versionId, '--wait', String(wait), '--no-prompt'];
        if (alias !== undefined) installArgs.push('--target-org', alias);
        // eslint-disable-next-line no-await-in-loop
        await flow.runCommand('package:install', installArgs);
        flow.log(`Installed ${step.versionId}.`);
      } else if (step.kind === 'metadata') {
        if (installed.has(step.versionId)) {
          flow.log(`Already installed (${step.versionId}): ${step.repoUrl}/${step.subfolder} — skipping.`);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await deployMetadataStep(step, alias ?? '', flow.shipDir, flow.log, flow.runCommand);
      } else {
        flow.log(`Skipping ${describeStep(step)} — not yet supported.`);
      }
    }
  },
} satisfies TaskDefinition;
