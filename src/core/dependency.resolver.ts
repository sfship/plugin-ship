import { parse } from 'yaml';
import type { CciDependency, ShipDependency } from './config.dependency.js';
import { CumulusCISchema } from './config.cci.js';
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

/** Normalises a GitHub reference to an `owner/repo` slug, accepting full URLs or slugs. */
function normalizeRepo(github: string): string {
  return github.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
}

/** Fetches the tag name of the latest GitHub release for `repo`. */
async function fetchLatestTag(repo: string): Promise<string> {
  const token = getGithubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch latest release for ${repo}: ${res.statusText}`);
  const { tag_name: tagName } = (await res.json()) as { tag_name: string };
  return tagName;
}

/** Fetches raw file content from a GitHub repository at a specific ref. Returns `null` if the file does not exist. */
async function fetchRaw(repo: string, ref: string, filename: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${filename}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch ${filename} from ${repo}@${ref}: ${res.statusText}`);
  return res.text();
}

/**
 * Resolves a GitHub repository dependency into an ordered list of steps.
 *
 * If `subfolder` is set, emits a single {@link MetadataStep} for that directory.
 * Otherwise fetches the repo's config file (`ship.yml` or `cumulusci.yml`) and recurses
 * into its dependency list.
 *
 * Throws if a circular dependency is detected or if the config file is missing.
 */
async function resolveGitHubRepo(
  github: string,
  type: 'ship' | 'cci',
  tag: string | undefined,
  subfolder: string | undefined,
  unmanaged: boolean | undefined,
  visited: Set<string>
): Promise<DependencyStep[]> {
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

  const ref = tag ?? (await fetchLatestTag(repo));
  const configFile = type === 'cci' ? 'cumulusci.yml' : 'ship.yml';
  const raw = await fetchRaw(repo, ref, configFile);
  if (!raw) throw new Error(`${configFile} not found in ${repo}@${ref}`);

  const parsed = parse(raw) as unknown;

  if (type === 'cci') {
    const result = CumulusCISchema.safeParse(parsed);
    if (!result.success) throw new Error(`Invalid cumulusci.yml in ${repo}@${ref}`);
    return resolveCciDeps(result.data.project.dependencies ?? [], visited);
  } else {
    const result = ShipConfigSchema.safeParse(parsed);
    if (!result.success) throw new Error(`Invalid ship.yml in ${repo}@${ref}`);
    return resolveShipDeps(result.data.dependencies ?? [], visited);
  }
}

/**
 * Resolves a list of CumulusCI dependencies into an ordered list of steps.
 * GitHub entries within a CCI config are always treated as CCI dependencies.
 */
async function resolveCciDeps(deps: CciDependency[], visited: Set<string>): Promise<DependencyStep[]> {
  return (
    await Promise.all(
      deps.map((dep) => {
        if ('github' in dep) {
          return resolveGitHubRepo(dep.github, 'cci', dep.tag, dep.subfolder, dep.unmanaged, visited);
        }
        if ('namespace' in dep) {
          const key = `namespace:${dep.namespace}`;
          if (visited.has(key)) return [];
          visited.add(key);
          return [{ kind: 'package-namespace' as const, namespace: dep.namespace, version: dep.version }];
        }
        // eslint-disable-next-line camelcase
        const key = `versionId:${dep.version_id}`;
        if (visited.has(key)) return [];
        visited.add(key);
        // eslint-disable-next-line camelcase
        return [{ kind: 'package-id' as const, versionId: dep.version_id }];
      })
    )
  ).flat();
}

/** Resolves a list of plugin-ship dependencies into an ordered list of steps. */
async function resolveShipDeps(deps: ShipDependency[], visited: Set<string>): Promise<DependencyStep[]> {
  return (
    await Promise.all(
      deps.map((dep) => {
        if ('github' in dep) {
          return resolveGitHubRepo(dep.github, dep.type, dep.tag, dep.subfolder, dep.unmanaged, visited);
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
 * GitHub dependencies are resolved recursively by fetching the remote `ship.yml` or `cumulusci.yml`.
 * Ordering is preserved within each project's dependency list, and duplicate packages are
 * deduplicated — the first occurrence wins. Circular GitHub repository references throw.
 *
 * @param deps - The top-level dependency list from `ship.yml`.
 * @returns Ordered list of {@link DependencyStep} ready for execution.
 */
export async function resolveDependencies(deps: ShipDependency[]): Promise<DependencyStep[]> {
  return resolveShipDeps(deps, new Set<string>());
}
