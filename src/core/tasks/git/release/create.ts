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
/* eslint-disable camelcase */

import {
  getGithubToken,
  normalizeRepo,
  gh,
  fetchFirstCommitSha,
  resolveCommitSha,
  type GitTagObject,
  type Release,
  type ReleaseListItem,
} from '../../../service.github.js';
import { resolveDependencies } from '../../../package.dependencies.js';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';

function buildInstallInfo(versionId: string, prerelease: boolean): string {
  const lines = [
    '## Installation Info',
    '',
    '**Sandbox & Scratch Orgs:**',
    `https://test.salesforce.com/packaging/installPackage.apexp?p0=${versionId}`,
  ];
  if (!prerelease) {
    lines.push(
      '',
      '**Production & Developer Edition Orgs:**',
      `https://login.salesforce.com/packaging/installPackage.apexp?p0=${versionId}`
    );
  }
  return lines.join('\n');
}

export default {
  description:
    'Creates an annotated git tag carrying the package version metadata, then a GitHub release pointing to it. Inherits CumulusCI’s tag annotation format so consumers resolve the version through a single path.',
  params: [
    {
      name: 'tag',
      type: 'string',
      required: true,
      description: 'Tag name to create (e.g. "v1.2.3").',
    },
    {
      name: 'version-id',
      type: 'string',
      required: true,
      description: '04t SubscriberPackageVersionId to embed in the tag annotation.',
    },
    {
      name: 'package-type',
      type: 'string',
      required: false,
      default: '2GP',
      description: 'Package type written into the annotation (e.g. 2GP, Unlocked, 1GP).',
    },
    {
      name: 'prerelease',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Mark the GitHub release as a prerelease.',
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Release name. Defaults to the tag.',
    },
    {
      name: 'body',
      type: 'string',
      required: false,
      description:
        'Release body. When omitted, GitHub auto-generates notes from PRs and commits since the previous release. Pass any value (including an empty string) to opt out of auto-generation and use your own.',
    },
    {
      name: 'install-link',
      type: 'boolean',
      required: false,
      default: true,
      description:
        'Prepend a Salesforce package-install link section (test + login URLs for the 04t) to the release body. Defaults to true.',
    },
    {
      name: 'target',
      type: 'string',
      required: false,
      description: 'Commit SHA or branch to tag. Defaults to the repository’s default branch.',
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
      name: 'tag',
      type: 'string',
      description: 'The created tag name.',
    },
    {
      name: 'release-url',
      type: 'string',
      description: 'URL of the created GitHub release.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const tagName = params['tag'] as string;
    const versionId = params['version-id'] as string;
    const packageType = (params['package-type'] as string | undefined) ?? '2GP';
    const prerelease = params['prerelease'] === true;
    const releaseName = (params['name'] as string | undefined) ?? tagName;
    const customBody = params['body'] as string | undefined;
    const generateReleaseNotes = customBody === undefined;
    const installInfo = params['install-link'] !== false ? buildInstallInfo(versionId, prerelease) : '';
    const releaseBody = [installInfo, customBody ?? ''].filter((s) => s.length > 0).join('\n\n');
    const alias = String(params['github-alias'] ?? 'default');

    const token = getGithubToken(alias);
    if (!token) {
      throw new ExpectedError(`No GitHub token found for alias "${alias}". Run: sf ship service connect github`);
    }

    const repoUrl = (params['repo-url'] as string | undefined) ?? flow.config.project.git?.repoUrl;
    if (!repoUrl) {
      throw new ExpectedError(
        'No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.'
      );
    }
    const repo = normalizeRepo(repoUrl);

    const commitSha = await resolveCommitSha(params['target'] as string | undefined, token, repo);

    const depsForAnnotation: Array<{ version_id: string; package_name?: string }> = [];
    const deps = flow.config.project.package?.dependencies ?? [];
    if (deps.length > 0) {
      flow.log('Resolving dependencies for tag annotation...');
      const steps = await resolveDependencies(deps);
      for (const step of steps) {
        if (step.kind === 'package-id') {
          // eslint-disable-next-line camelcase
          depsForAnnotation.push({ version_id: step.versionId, package_name: step.name });
        }
      }
    }

    const tagMessage = [
      `version_id: ${versionId}`,
      `package_type: ${packageType}`,
      `dependencies: ${JSON.stringify(depsForAnnotation)}`,
    ].join('\n');

    flow.log(`Creating annotated tag ${tagName} at ${commitSha.slice(0, 7)}...`);
    const tagObj = await gh<GitTagObject>(token, `/repos/${repo}/git/tags`, {
      method: 'POST',
      body: {
        tag: tagName,
        message: tagMessage,
        object: commitSha,
        type: 'commit',
        tagger: { name: 'plugin-ship', email: 'noreply@plugin-ship', date: new Date().toISOString() },
      },
    });

    flow.log(`Creating tag reference refs/tags/${tagName}...`);
    await gh(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/tags/${tagName}`, sha: tagObj.sha },
    });

    // For production releases, anchor auto-generated notes against the previous
    // production release. If none exists, anchor against the first commit so notes
    // span the full history rather than an arbitrary prerelease.
    let previousTagName: string | undefined;
    if (!prerelease && generateReleaseNotes) {
      const releases = await gh<ReleaseListItem[]>(token, `/repos/${repo}/releases?per_page=30`);
      const previousProd = releases.find((r) => !r.prerelease);
      if (previousProd) {
        previousTagName = previousProd.tag_name;
      } else {
        const firstSha = await fetchFirstCommitSha(repo, token);
        if (firstSha) previousTagName = firstSha;
      }
    }

    flow.log(`Creating GitHub release ${tagName}...`);
    const release = await gh<Release>(token, `/repos/${repo}/releases`, {
      method: 'POST',
      body: {
        tag_name: tagName,
        name: releaseName,
        body: releaseBody,
        prerelease,
        generate_release_notes: generateReleaseNotes,
        ...(previousTagName !== undefined ? { previous_tag_name: previousTagName } : {}),
      },
    });

    flow.log(`Released: ${release.html_url}`);
    output.set('tag', tagName);
    output.set('release-url', release.html_url);
  },
} satisfies TaskDefinition;
