export const VERSION_TYPES = ['build', 'patch', 'minor', 'major'] as const;
export type VersionType = (typeof VERSION_TYPES)[number];

type Semver = { major: number; minor: number; patch: number };

export function parseSemver(s: string): Semver | null {
  const match = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

export function bump(base: Semver, type: VersionType): Semver {
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

/**
 * Computes the next `.NEXT` version string from the latest release tag and the requested bump type.
 *
 * A 'build' bump on an existing release secretly bumps minor instead — sf won't allow a new
 * build version in a series that already has a promoted production release.
 */
export function resolveNextVersion(tagName: string | null, versionType: VersionType): string {
  let base: Semver = { major: 0, minor: 0, patch: 0 };
  if (tagName) {
    const parsed = parseSemver(tagName);
    if (parsed) base = parsed;
  }
  const effectiveType: VersionType = versionType === 'build' && tagName !== null ? 'minor' : versionType;
  const next = bump(base, effectiveType);
  return `${next.major}.${next.minor}.${next.patch}.NEXT`;
}
