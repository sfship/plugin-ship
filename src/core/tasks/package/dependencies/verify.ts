import { StandardColors } from '@salesforce/sf-plugins-core';
import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolveDependencies, type PackageIdStep } from '../../../package.resolver.js';
import { readSfdxProject, defaultPackageDirectory } from '../../../sfdx-project.js';
import { ExpectedError } from '../../../error.js';

export default {
  description:
    'Verifies that the dependencies declared in ship.yml match what is committed in sfdx-project.json, failing if they have drifted. Guards a release build against stale or unsynced dependencies.',
  async run({ flow }: TaskContext): Promise<void> {
    const deps = flow.config.project.package?.dependencies ?? [];
    const steps = (await resolveDependencies(deps)).filter((s): s is PackageIdStep => s.kind === 'package-id');
    const expected = new Set(steps.map((s) => s.versionId));

    // versionId -> human-readable name, gathered from both sides so drift can name the package.
    const names = new Map<string, string>();
    for (const step of steps) {
      if (step.name) names.set(step.versionId, step.name);
    }

    const project = readSfdxProject(flow.projectDir);
    const aliases = project.packageAliases ?? {};
    const committed = new Set<string>();
    for (const dep of defaultPackageDirectory(project)?.dependencies ?? []) {
      const versionId = aliases[dep.package] ?? dep.package;
      committed.add(versionId);
      // A committed dep referenced by a packageAlias carries its name in `package`.
      if (dep.package !== versionId && !names.has(versionId)) names.set(versionId, dep.package);
    }

    const missing = [...expected].filter((id) => !committed.has(id));
    const stale = [...committed].filter((id) => !expected.has(id));

    if (missing.length || stale.length) {
      const label = (id: string): string => {
        const name = names.get(id);
        return name ? `${name} (${id})` : id;
      };
      const width = Math.max(...[...missing, ...stale].map((id) => label(id).length));
      throw new ExpectedError(
        [
          StandardColors.error('Dependencies are out of sync.'),
          `${StandardColors.info('ship.yml')} resolves to a different set than ${StandardColors.info(
            'sfdx-project.json'
          )} declares:`,
          '',
          ...missing.map(
            (id) =>
              `    ${StandardColors.success('+')} ${label(id).padEnd(
                width
              )}  in ship.yml, missing from sfdx-project.json`
          ),
          ...stale.map(
            (id) =>
              `    ${StandardColors.error('-')} ${label(id).padEnd(width)}  in sfdx-project.json, dropped from ship.yml`
          ),
          '',
          `${StandardColors.info('→ To fix, run this and commit the change:')}`,
          `    ${StandardColors.success('sf ship flow run dependencies/sync')}`,
        ].join('\n')
      );
    }

    flow.log(`Dependencies in sync (${expected.size} package${expected.size === 1 ? '' : 's'}).`);
  },
} satisfies TaskDefinition;
