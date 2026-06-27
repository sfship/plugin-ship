import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';
import { normalizeRepo, fetchRelease } from '../../../service.github.js';
import { VERSION_TYPES, resolveNextVersion, type VersionType } from '../../../package.version.js';

export default {
  description:
    'Resolves the next package version number by reading the latest GitHub release. Outputs a `.NEXT` version so sf assigns the build slot automatically. Ancestor is handled by sf via `ancestorVersion: "HIGHEST"` in sfdx-project.json (scaffolded by `package/create`), so no ancestor output is needed.',
  params: [
    {
      name: 'version-type',
      type: 'string',
      required: false,
      default: 'build',
      description:
        'Which part of the version to bump relative to the latest released version. One of: build, patch, minor, major.',
    },
    {
      name: 'repo-url',
      type: 'string',
      required: false,
      description: 'GitHub repository URL. Falls back to config.project.git.repoUrl.',
    },
  ],
  outputs: [
    {
      name: 'version-number',
      type: 'string',
      description:
        'Next version number ending in `.NEXT`, ready to pass to `sf package version create --version-number`.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const versionType = (params['version-type'] as string | undefined) ?? 'build';
    if (!VERSION_TYPES.includes(versionType as VersionType)) {
      throw new ExpectedError(`Invalid version-type "${versionType}". Use one of: ${VERSION_TYPES.join(', ')}.`);
    }

    const repoUrl = (params['repo-url'] as string | undefined) ?? flow.config.project.git?.repoUrl;
    if (!repoUrl) {
      throw new ExpectedError(
        'No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.'
      );
    }
    const repo = normalizeRepo(repoUrl);

    const release = await fetchRelease(repo);
    const versionNumber = resolveNextVersion(release?.tagName ?? null, versionType as VersionType);

    if (release) {
      flow.log(`Latest release: ${release.tagName}. Bumping ${versionType} → ${versionNumber}`);
    } else {
      flow.log(`No prior GitHub release found. First version: ${versionNumber}`);
    }

    output.set('version-number', versionNumber);
  },
} satisfies TaskDefinition;
