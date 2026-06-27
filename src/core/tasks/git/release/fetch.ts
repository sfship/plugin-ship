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
import { fetchRelease, fetchGitTag, normalizeRepo } from '../../../service.github.js';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';

export default {
  description: 'Resolves a package version ID from the latest GitHub release or pre-release.',
  params: [
    {
      name: 'prerelease',
      type: 'boolean',
      required: false,
      default: false,
      description:
        'When true, resolves from the latest pre-release. When false (default), the latest production release.',
    },
    {
      name: 'tag',
      type: 'string',
      required: false,
      description: 'Specific release tag to resolve. Overrides prerelease.',
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
      name: 'version-id',
      type: 'string',
      description: 'The 04t SubscriberPackageVersionId from the release tag annotation.',
    },
    {
      name: 'version-number',
      type: 'string',
      description: 'Full version number (e.g. "0.4.0.1"), derived from the tag name.',
    },
    {
      name: 'version-base',
      type: 'string',
      description: 'Major.minor.patch portion only (e.g. "0.4.0").',
    },
    {
      name: 'tag',
      type: 'string',
      description: 'The release tag name (e.g. "v0.4.0.1").',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const repoUrl = (params['repo-url'] as string | undefined) ?? flow.config.project.git?.repoUrl;
    if (!repoUrl) {
      throw new ExpectedError('No repo URL. Set project.git.repoUrl in ship.yml or pass --param repo-url=<url>.');
    }
    const repo = normalizeRepo(repoUrl);
    const prerelease = params['prerelease'] === true;
    const tag = params['tag'] as string | undefined;

    const release = await fetchRelease(repo, tag, prerelease);
    if (!release) {
      throw new ExpectedError(`No ${prerelease ? 'pre-release' : 'production release'} found for ${repo}.`);
    }

    const gitTag = await fetchGitTag(repo, release.tagName);
    if (!gitTag) {
      throw new ExpectedError(`No release metadata found in tag ${release.tagName} for ${repo}.`);
    }

    const match = /version_id:\s*(\S+)/.exec(gitTag.message);
    if (!match) {
      throw new ExpectedError(`No version_id found in tag annotation for ${release.tagName}.`);
    }

    const versionId = match[1];
    const rawVersion = release.tagName.replace(/^v/, '');
    const parts = rawVersion.split('.');

    flow.log(`Resolved ${repo} → ${rawVersion} (${versionId}) [${prerelease ? 'pre-release' : 'release'}]`);
    output.set('version-id', versionId);
    output.set('tag', release.tagName);
    if (rawVersion) output.set('version-number', rawVersion);
    if (parts.length >= 3) output.set('version-base', `${parts[0]}.${parts[1]}.${parts[2]}`);
  },
} satisfies TaskDefinition;
