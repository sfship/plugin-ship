import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { resolveDependencies, type PackageIdStep } from '../../../package.resolver.js';
import { readSfdxProject, writeSfdxProject, defaultPackageDirectory } from '../../../sfdx-project.js';
import { ExpectedError } from '../../../error.js';

export default {
  description:
    'Resolves the dependencies declared in ship.yml and writes them into sfdx-project.json so a validated `package version create` can compile against them. Run whenever your dependencies change and commit the diff — that diff is your record of which dependency versions a release builds against.',
  async run({ flow }: TaskContext): Promise<void> {
    const deps = flow.config.project.package?.dependencies ?? [];
    const steps = (await resolveDependencies(deps)).filter((s): s is PackageIdStep => s.kind === 'package-id');

    const project = readSfdxProject(flow.projectDir);
    const packageDir = defaultPackageDirectory(project);
    if (!packageDir?.package) {
      throw new ExpectedError(
        'No package registered in sfdx-project.json (the default packageDirectory has no "package"). Run `sf ship flow run create/package` first.'
      );
    }

    // Reference each named dependency through a packageAlias so the diff stays readable;
    // fall back to the raw 04t for dependencies that declare no name in ship.yml.
    const aliases = { ...project.packageAliases };
    const dependencies = steps.map((step) => {
      if (step.name) {
        aliases[step.name] = step.versionId;
        return { package: step.name };
      }
      return { package: step.versionId };
    });

    if (dependencies.length) packageDir.dependencies = dependencies;
    else delete packageDir.dependencies;
    project.packageAliases = aliases;

    writeSfdxProject(flow.projectDir, project);

    flow.log(
      dependencies.length
        ? `Wrote ${dependencies.length} dependenc${dependencies.length === 1 ? 'y' : 'ies'} to sfdx-project.json.`
        : 'No dependencies in ship.yml — cleared sfdx-project.json dependencies.'
    );
  },
} satisfies TaskDefinition;
