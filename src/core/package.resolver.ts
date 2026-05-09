import { parse } from 'yaml';
import type { ShipDependency, ShipGitHubDependency } from './config.dependency.schema.js';
import { ShipConfigSchema } from './config.ship.schema.js';
import { ExpectedError } from './util.error.js';
import {
  normalizeRepo,
  fetchRelease,
  fetchRaw,
  fetchGitTag,
  fetchCciNamespace,
  fetchSubdirs,
} from './service.github.js';

/** Install a specific package version by its 04t ID. */
export type PackageIdStep = { kind: 'package-id'; versionId: string; name?: string };

/** Deploy a subdirectory from a GitHub repository as metadata, with namespace tokens injected. */
export type MetadataStep = { kind: 'metadata'; repoUrl: string; subfolder: string; namespace: string; tag: string };

/** A single resolved install or deploy step produced by the dependency resolver. */
export type DependencyStep = PackageIdStep | MetadataStep;

/** Parsed metadata from a CCI annotated git tag message. */
type CciTagMetadata = {
  versionId: string;
  dependencies: Array<{ version_id: string; package_name?: string }>;
};

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
 * For CCI repos, reads the annotated git tag message for the package version ID and
 * transitive deps, and discovers `unpackaged/pre` and `unpackaged/post` subdirectories
 * to emit {@link MetadataStep}s before and after the package install steps.
 *
 * For ship repos, fetches `ship.yml` and recurses into its dependency list.
 */
async function resolveGitHubRepo(dep: ShipGitHubDependency, visited: Set<string>): Promise<DependencyStep[]> {
  const { github, type, tag, name } = dep;
  const repo = normalizeRepo(github);

  // Circular dependency detection — added synchronously before the first await
  // so it is safe to call from Promise.all.
  if (visited.has(repo)) throw new ExpectedError(`Circular dependency detected: ${repo}`);
  visited.add(repo);

  const release = await fetchRelease(repo, tag);
  if (!release) throw new ExpectedError(`No GitHub release found for ${repo}${tag ? `@${tag}` : ''}`);

  if (type === 'cci') {
    const [gitTag, namespace, preSubdirs, postSubdirs] = await Promise.all([
      fetchGitTag(repo, release.tagName),
      fetchCciNamespace(repo, release.tagName),
      fetchSubdirs(repo, release.tagName, 'unpackaged/pre'),
      fetchSubdirs(repo, release.tagName, 'unpackaged/post'),
    ]);

    const metadata = gitTag ? parseCciTagMessage(gitTag.message) : null;
    if (!metadata) throw new ExpectedError(`No CCI release metadata found in tag ${release.tagName} for ${repo}`);

    const steps: DependencyStep[] = [];
    const repoUrl = `https://github.com/${repo}`;

    for (const subfolder of preSubdirs) {
      const key = `${repo}:${subfolder}`;
      if (!visited.has(key)) {
        visited.add(key);
        steps.push({ kind: 'metadata', repoUrl, subfolder, namespace, tag: release.tagName });
      }
    }

    for (const transitive of metadata.dependencies) {
      if (!visited.has(transitive.version_id)) {
        visited.add(transitive.version_id);
        steps.push({ kind: 'package-id', versionId: transitive.version_id, name: transitive.package_name });
      }
    }

    if (!visited.has(metadata.versionId)) {
      visited.add(metadata.versionId);
      steps.push({ kind: 'package-id', versionId: metadata.versionId, name });
    }

    for (const subfolder of postSubdirs) {
      const key = `${repo}:${subfolder}`;
      if (!visited.has(key)) {
        visited.add(key);
        steps.push({ kind: 'metadata', repoUrl, subfolder, namespace, tag: release.tagName });
      }
    }

    return steps;
  } else {
    const raw = await fetchRaw(repo, release.tagName, 'ship.yml');
    if (!raw) throw new ExpectedError(`ship.yml not found in ${repo}@${release.tagName}`);
    const parsed = parse(raw) as unknown;
    const result = ShipConfigSchema.safeParse(parsed);
    if (!result.success) throw new ExpectedError(`Invalid ship.yml in ${repo}@${release.tagName}`);
    return resolveShipDeps(result.data.dependencies ?? [], visited);
  }
}

/** Resolves a list of plugin-ship dependencies into an ordered list of steps. */
async function resolveShipDeps(deps: ShipDependency[], visited: Set<string>): Promise<DependencyStep[]> {
  return (
    await Promise.all(
      deps.map((dep) => {
        // Resolve Github dependency
        if ('github' in dep) {
          return resolveGitHubRepo(dep, visited);
        }
        // Resolve 04t dependency
        if (visited.has(dep.versionId)) return [];
        visited.add(dep.versionId);
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
