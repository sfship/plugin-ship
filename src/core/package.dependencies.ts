/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ShipDependency, ShipGitHubDependency } from './config.dependency.schema.js';
import { ExpectedError } from './error.js';
import { normalizeRepo, fetchRelease, fetchGitTag, fetchCciNamespace, fetchSubdirs } from './service.github.js';
import { type SfdxProject, defaultPackageDirectory } from './sfdx-project.js';

/** Install a specific package version by its 04t ID. */
export type PackageIdStep = { kind: 'package-id'; versionId: string; name?: string };

/** Deploy a subdirectory from a GitHub repository as metadata, with namespace tokens injected. */
export type MetadataStep = {
  kind: 'metadata';
  repoUrl: string;
  subfolder: string;
  namespace: string;
  tag: string;
  /** 04t package version ID of the release this bundle ships with — lets the installer skip it when already present. */
  versionId: string;
};

/** A single resolved install or deploy step produced by the dependency resolver. */
export type DependencyStep = PackageIdStep | MetadataStep;

/** Parsed metadata from a release's annotated git tag message. */
type TagMetadata = {
  versionId: string;
  dependencies: Array<{ version_id: string; package_name?: string }>;
};

/**
 * Parses a release's annotated tag message into its version ID and dependency list.
 * Returns `null` if the message does not contain the expected structured block.
 *
 * The format originated with CumulusCI and is inherited unchanged so ship- and
 * CCI-released packages resolve through the same path:
 * ```
 * version_id: 04tXXX
 * package_type: 2GP
 * dependencies: [{"version_id": "04tYYY", "package_name": "..."}]
 * ```
 */
function parseTagMessage(message: string): TagMetadata | null {
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
 * Reads the annotated tag message on the latest (or pinned) release for the package
 * version ID and its pre-flattened transitive dependency list, and discovers any
 * `unpackaged/pre` / `unpackaged/post` subdirectories to deploy before and after the
 * package install.
 */
async function resolveGitHubRepo(dep: ShipGitHubDependency, visited: Set<string>): Promise<DependencyStep[]> {
  const { github, tag, name } = dep;
  const repo = normalizeRepo(github);

  // Circular dependency detection — added synchronously before the first await
  // so it is safe to call from Promise.all.
  if (visited.has(repo)) throw new ExpectedError(`Circular dependency detected: ${repo}`);
  visited.add(repo);

  const release = await fetchRelease(repo, tag);
  if (!release) throw new ExpectedError(`No GitHub release found for ${repo}${tag ? `@${tag}` : ''}`);

  const [gitTag, namespace, preSubdirs, postSubdirs] = await Promise.all([
    fetchGitTag(repo, release.tagName),
    fetchCciNamespace(repo, release.tagName),
    fetchSubdirs(repo, release.tagName, 'unpackaged/pre'),
    fetchSubdirs(repo, release.tagName, 'unpackaged/post'),
  ]);

  const metadata = gitTag ? parseTagMessage(gitTag.message) : null;
  if (!metadata) throw new ExpectedError(`No release metadata found in tag ${release.tagName} for ${repo}`);

  const steps: DependencyStep[] = [];
  const repoUrl = `https://github.com/${repo}`;

  for (const subfolder of preSubdirs) {
    const key = `${repo}:${subfolder}`;
    if (!visited.has(key)) {
      visited.add(key);
      steps.push({
        kind: 'metadata',
        repoUrl,
        subfolder,
        namespace,
        tag: release.tagName,
        versionId: metadata.versionId,
      });
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
      steps.push({
        kind: 'metadata',
        repoUrl,
        subfolder,
        namespace,
        tag: release.tagName,
        versionId: metadata.versionId,
      });
    }
  }

  return steps;
}

/** Resolves a list of plugin-ship dependencies into an ordered list of steps. */
async function resolveShipDeps(deps: ShipDependency[], visited: Set<string>): Promise<DependencyStep[]> {
  return (
    await Promise.all(
      deps.map((dep) => {
        // Resolve GitHub dependency
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
 * GitHub dependencies are resolved by reading the annotated tag message on the repo's latest
 * (or pinned) release. The tag carries the package's own version_id and a pre-flattened
 * transitive dependency list, so no recursive remote config fetching is needed. The format
 * is inherited from CumulusCI so ship- and CCI-released packages resolve uniformly.
 *
 * Duplicate packages are deduplicated — the first occurrence wins. Circular GitHub repository
 * references throw.
 *
 * @param deps - The top-level dependency list from `ship.yml`.
 * @returns Ordered list of {@link DependencyStep} ready for execution.
 */
export async function resolveDependencies(deps: ShipDependency[]): Promise<DependencyStep[]> {
  return resolveShipDeps(deps, new Set<string>());
}

export type DriftResult = {
  /** Version IDs present in ship.yml but missing from sfdx-project.json. */
  missing: string[];
  /** Version IDs present in sfdx-project.json but no longer in ship.yml. */
  stale: string[];
  /** versionId → human-readable name, gathered from both sides for use in error output. */
  names: Map<string, string>;
};

/** Compares resolved ship.yml package-id steps against the dependencies committed in sfdx-project.json. */
export function computeDrift(steps: PackageIdStep[], project: SfdxProject): DriftResult {
  const expected = new Set(steps.map((s) => s.versionId));
  const names = new Map<string, string>();
  for (const step of steps) {
    if (step.name) names.set(step.versionId, step.name);
  }

  const aliases = project.packageAliases ?? {};
  const committed = new Set<string>();
  for (const dep of defaultPackageDirectory(project)?.dependencies ?? []) {
    const versionId = aliases[dep.package] ?? dep.package;
    committed.add(versionId);
    if (dep.package !== versionId && !names.has(versionId)) names.set(versionId, dep.package);
  }

  return {
    missing: [...expected].filter((id) => !committed.has(id)),
    stale: [...committed].filter((id) => !expected.has(id)),
    names,
  };
}
