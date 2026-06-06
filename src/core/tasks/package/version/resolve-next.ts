import type { TaskContext, TaskDefinition } from '../../../task.js';
import { ExpectedError } from '../../../util.error.js';
import { normalizeRepo, fetchRelease, fetchGitTag } from '../../../service.github.js';

const VERSION_TYPES = ['build', 'patch', 'minor', 'major'] as const;
type VersionType = (typeof VERSION_TYPES)[number];

/** Parses a "1.2.3" or "v1.2.3" string into its components. Returns null if no version pattern is found. */
function parseSemver(s: string): { major: number; minor: number; patch: number } | null {
  const match = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function bump(base: { major: number; minor: number; patch: number }, type: VersionType): typeof base {
  switch (type) {
    case 'major':
      return { major: base.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: base.major, minor: base.minor + 1, patch: 0 };
    case 'patch':
      return { major: base.major, minor: base.minor, patch: base.patch + 1 };
    case 'build':
      return { ...base };
  }
}

export default {
  description:
    'Resolves the next package version number and ancestor 04t by reading the latest GitHub release. Outputs a `.NEXT` version so sf assigns the build slot automatically.',
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
    {
      name: 'github-alias',
      type: 'string',
      required: false,
      default: 'default',
      description: 'GitHub token alias.',
    },
  ],
  outputs: [
    {
      name: 'version-number',
      type: 'string',
      description:
        'Next version number ending in `.NEXT`, ready to pass to `sf package version create --version-number`.',
    },
    {
      name: 'ancestor-id',
      type: 'string',
      description:
        'The 04t SubscriberPackageVersionId of the latest released version. Empty when no prior release exists.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const versionType = (params['version-type'] as string | undefined) ?? 'build';
    if (!VERSION_TYPES.includes(versionType as VersionType)) {
      throw new ExpectedError(`Invalid version-type "${versionType}". Use one of: ${VERSION_TYPES.join(', ')}.`);
    }

    const repoUrl = flow.config.project.git?.repoUrl ?? String(params['repo-url'] ?? '');
    if (!repoUrl) {
      throw new ExpectedError(
        'No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.'
      );
    }
    const repo = normalizeRepo(repoUrl);

    // Find the latest GitHub release. If none, we're cutting the first version.
    const release = await fetchRelease(repo);

    let base = { major: 0, minor: 0, patch: 0 };
    let ancestorId = '';

    if (release) {
      // Parse the version from the tag name (e.g. "v1.2.3" or "1.2.3").
      const parsed = parseSemver(release.tagName);
      if (parsed) base = parsed;

      // Pull the ancestor 04t out of the tag annotation (the CCI-format block we write on release).
      const gitTag = await fetchGitTag(repo, release.tagName);
      if (gitTag) {
        const versionIdMatch = gitTag.message.match(/^version_id:\s*(04t[A-Za-z0-9]{12,15})/m);
        if (versionIdMatch) ancestorId = versionIdMatch[1];
      }
    }

    const next = bump(base, versionType as VersionType);
    const versionNumber = `${next.major}.${next.minor}.${next.patch}.NEXT`;

    if (release) {
      flow.log(
        `Latest release: ${release.tagName} (ancestor: ${
          ancestorId || 'none'
        }). Bumping ${versionType} → ${versionNumber}`
      );
    } else {
      flow.log(`No prior GitHub release found. First version: ${versionNumber}`);
    }

    output.set('version-number', versionNumber);
    output.set('ancestor-id', ancestorId);
  },
} satisfies TaskDefinition;
