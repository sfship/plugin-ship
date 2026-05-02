import { parse } from 'yaml';
import type { ShipDependency, ShipGitHubDependency } from './config.dependency.js';
import { ShipConfigSchema } from './config.ship.js';
import { getGithubToken } from './services/github.js';

/** Install a specific package version by its 04t ID. */
export type PackageIdStep = { kind: 'package-id'; versionId: string; name?: string };

/** Install a 1GP managed package by namespace and version number. */
export type PackageNamespaceStep = { kind: 'package-namespace'; namespace: string; version: string };

/** Deploy a subdirectory from a GitHub repository as unmanaged metadata. */
export type MetadataStep = { kind: 'metadata'; repoUrl: string; subfolder: string; unmanaged: boolean };

/** A single resolved install or deploy step produced by the dependency resolver. */
export type DependencyStep = PackageIdStep | PackageNamespaceStep | MetadataStep;

/** A GitHub release with its associated tag name. */
type Release = { tagName: string };

/** Parsed metadata from a CCI annotated git tag message. */
type CciTagMetadata = {
  versionId: string;
  dependencies: Array<{ version_id: string; package_name?: string }>;
};

/** Normalises a GitHub reference to an `owner/repo` slug, accepting full URLs or slugs. */
function normalizeRepo(github: string): string {
  return github.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
}

function githubHeaders(): Record<string, string> {
  const token = getGithubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Fetches a GitHub release for `repo`. Returns `null` if no release exists.
 * When `tag` is provided, fetches that specific release; otherwise fetches the latest.
 */
async function fetchRelease(repo: string, tag?: string): Promise<Release | null> {
  const url = tag
    ? `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`
    : `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch release for ${repo}: ${res.statusText}`);
  const data = (await res.json()) as { tag_name: string };
  return { tagName: data.tag_name };
}

/** Fetches raw file content from a GitHub repository at a specific ref. Returns `null` if the file does not exist. */
async function fetchRaw(repo: string, ref: string, filename: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${filename}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch ${filename} from ${repo}@${ref}: ${res.statusText}`);
  return res.text();
}

/**
 * Fetches the annotated git tag object for `tagName` in `repo`.
 * Returns `null` for lightweight tags (no message) or if the tag does not exist.
 */
async function fetchGitTag(repo: string, tagName: string): Promise<{ message: string } | null> {
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/tags/${encodeURIComponent(tagName)}`, {
    headers: githubHeaders(),
  });
  if (!refRes.ok) return null;
  const ref = (await refRes.json()) as { object: { type: string; sha: string } };
  if (ref.object.type !== 'tag') return null; // lightweight tag — no message

  const tagRes = await fetch(`https://api.github.com/repos/${repo}/git/tags/${ref.object.sha}`, {
    headers: githubHeaders(),
  });
  if (!tagRes.ok) return null;
  return (await tagRes.json()) as { message: string };
}

/**
 * Parses a CCI annotated tag message into its version ID and dependency list.
 * Returns `null` if the message does not follow the CCI release convention.
 *
 * CCI embeds metadata in the tag message in the form:
 * ```
 * version_id: 04tXXX
 * package_type: 1GP
 * dependencies: [{"version_id": "04tYYY", "package_name": "..."}]
 * ```
 */
function parseCciTagMessage(message: string): CciTagMetadata | null {
  const versionIdMatch = message.match(/^version_id:\s*(04t[A-Za-z0-9]{12,15})/m);
  if (!versionIdMatch) return null;

  let dependencies: Array<{ version_id: string; package_name?: string }> = [];
  const depsPrefixIndex = message.indexOf('dependencies:');
  if (depsPrefixIndex !== -1) {
    const afterDeps = message.slice(depsPrefixIndex + 'dependencies:'.length).trim();
    if (afterDeps.startsWith('[')) {
      try {
        dependencies = JSON.parse(afterDeps) as typeof dependencies;
      } catch {
        // leave as empty array
      }
    }
  }

  return { versionId: versionIdMatch[1], dependencies };
}

/**
 * Resolves a GitHub repository dependency into an ordered list of steps.
 *
 * If `subfolder` is set, emits a single {@link MetadataStep} for that directory.
 *
 * For CCI repos, reads the annotated git tag message which CCI embeds with a
 * pre-resolved `dependencies` array and the repo's own `version_id`. This follows
 * CCI's release convention and avoids recursive config fetching.
 *
 * For ship repos, fetches `ship.yml` and recurses into its dependency list.
 *
 * Throws if a circular dependency is detected or if the config file is missing.
 */
async function resolveGitHubRepo(dep: ShipGitHubDependency, visited: Set<string>): Promise<DependencyStep[]> {
  const { github, type, tag, subfolder, unmanaged, name } = dep;
  const repo = normalizeRepo(github);

  if (subfolder) {
    const key = `metadata:${repo}:${subfolder}`;
    if (visited.has(key)) return [];
    visited.add(key);
    return [{ kind: 'metadata', repoUrl: `https://github.com/${repo}`, subfolder, unmanaged: unmanaged ?? false }];
  }

  // Circular dependency detection — added synchronously before the first await
  // so it is safe to call from Promise.all.
  const repoKey = `repo:${repo}`;
  if (visited.has(repoKey)) throw new Error(`Circular dependency detected: ${repo}`);
  visited.add(repoKey);

  const release = await fetchRelease(repo, tag);
  if (!release) throw new Error(`No GitHub release found for ${repo}${tag ? `@${tag}` : ''}`);

  if (type === 'cci') {
    const gitTag = await fetchGitTag(repo, release.tagName);
    const metadata = gitTag ? parseCciTagMessage(gitTag.message) : null;

    if (!metadata) throw new Error(`No CCI release metadata found in tag ${release.tagName} for ${repo}`);

    const steps: DependencyStep[] = [];

    for (const transitive of metadata.dependencies) {
      const key = `versionId:${transitive.version_id}`;
      if (!visited.has(key)) {
        visited.add(key);
        steps.push({ kind: 'package-id', versionId: transitive.version_id, name: transitive.package_name });
      }
    }

    const ownKey = `versionId:${metadata.versionId}`;
    if (!visited.has(ownKey)) {
      visited.add(ownKey);
      steps.push({ kind: 'package-id', versionId: metadata.versionId, name });
    }

    return steps;
  } else {
    const raw = await fetchRaw(repo, release.tagName, 'ship.yml');
    if (!raw) throw new Error(`ship.yml not found in ${repo}@${release.tagName}`);
    const parsed = parse(raw) as unknown;
    const result = ShipConfigSchema.safeParse(parsed);
    if (!result.success) throw new Error(`Invalid ship.yml in ${repo}@${release.tagName}`);
    return resolveShipDeps(result.data.dependencies ?? [], visited);
  }
}

/** Resolves a list of plugin-ship dependencies into an ordered list of steps. */
async function resolveShipDeps(deps: ShipDependency[], visited: Set<string>): Promise<DependencyStep[]> {
  return (
    await Promise.all(
      deps.map((dep) => {
        if ('github' in dep) {
          return resolveGitHubRepo(dep, visited);
        }
        if ('namespace' in dep) {
          const key = `namespace:${dep.namespace}`;
          if (visited.has(key)) return [];
          visited.add(key);
          return [{ kind: 'package-namespace' as const, namespace: dep.namespace, version: dep.version }];
        }
        const key = `versionId:${dep.versionId}`;
        if (visited.has(key)) return [];
        visited.add(key);
        return [{ kind: 'package-id' as const, versionId: dep.versionId, name: dep.name }];
      })
    )
  ).flat();
}

/**
 * Resolves a `ship.yml` dependency list into a flat, ordered list of install and deploy steps.
 *
 * For CCI GitHub dependencies, reads the annotated git tag message which CCI embeds with a
 * pre-resolved dependency list and the repo's own `version_id` — no recursive config fetching needed.
 * For ship GitHub dependencies, fetches `ship.yml` and recurses into its dependency list.
 * Duplicate packages are deduplicated — the first occurrence wins. Circular GitHub repository
 * references throw.
 *
 * @param deps - The top-level dependency list from `ship.yml`.
 * @returns Ordered list of {@link DependencyStep} ready for execution.
 */
export async function resolveDependencies(deps: ShipDependency[]): Promise<DependencyStep[]> {
  return resolveShipDeps(deps, new Set<string>());
}
