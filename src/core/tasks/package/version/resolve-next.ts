import type { TaskContext, TaskDefinition } from '../../../task.js';
import { ExpectedError } from '../../../util.error.js';
import { normalizeRepo, fetchRelease } from '../../../service.github.js';

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

    // Find the latest GitHub release. If none, we're cutting the first version.
    const release = await fetchRelease(repo);

    let base = { major: 0, minor: 0, patch: 0 };
    if (release) {
      // Parse the version from the tag name (e.g. "v1.2.3" or "1.2.3").
      const parsed = parseSemver(release.tagName);
      if (parsed) base = parsed;
    }

    // A 'build' bump stays in the same X.Y.Z series. But fetchRelease returns the latest
    // non-prerelease (production) release, which has a promoted version in that series —
    // sf won't allow new versions there. Bump minor to open a fresh series.
    // (Patch versioning requires special Dev Hub enablement and is off by default.)
    const effectiveType: VersionType =
      versionType === 'build' && release !== null ? 'minor' : (versionType as VersionType);
    const next = bump(base, effectiveType);
    const versionNumber = `${next.major}.${next.minor}.${next.patch}.NEXT`;

    if (release) {
      flow.log(`Latest release: ${release.tagName}. Bumping ${versionType} → ${versionNumber}`);
    } else {
      flow.log(`No prior GitHub release found. First version: ${versionNumber}`);
    }

    output.set('version-number', versionNumber);
  },
} satisfies TaskDefinition;
