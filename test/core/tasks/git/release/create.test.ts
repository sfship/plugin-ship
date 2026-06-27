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

import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { DependencyStep } from '../../../../../src/core/package.dependencies.js';

let tokenValue: string | undefined = 'ghp_test';
let resolveCommitResult = 'a'.repeat(40);
let ghResponses: Record<string, unknown> = {};
let firstCommitShaResult: string | null = null;
let resolveDepsResult: DependencyStep[] = [];
let capturedTagBody: Record<string, unknown> | undefined;
let capturedReleaseBody: Record<string, unknown> | undefined;

const create = await mockTask('git/release/create.js', {
  'service.github.js': {
    getGithubToken: () => tokenValue,
    normalizeRepo: (url: string) => url.replace('https://github.com/', ''),
    resolveCommitSha: async () => resolveCommitResult,
    fetchFirstCommitSha: async () => firstCommitShaResult,
    gh: async <T>(_token: string, path: string, init?: { method?: string; body?: unknown }) => {
      if (init?.body) {
        const body = init.body as Record<string, unknown>;
        if ('object' in body) capturedTagBody = body;
        if ('tag_name' in body) capturedReleaseBody = body;
      }
      return (ghResponses[path] ?? {}) as T;
    },
  },
  'package.dependencies.js': {
    resolveDependencies: async () => resolveDepsResult,
  },
});

const baseParams = {
  tag: 'v1.2.3',
  'version-id': '04tAAA',
  'repo-url': 'https://github.com/acme/my-repo',
};

beforeEach(() => {
  tokenValue = 'ghp_test';
  resolveCommitResult = 'a'.repeat(40);
  ghResponses = {
    '/repos/acme/my-repo/git/tags': { sha: 'tag-obj-sha' },
    '/repos/acme/my-repo/releases?per_page=30': [],
    '/repos/acme/my-repo/releases': { html_url: 'https://github.com/acme/my-repo/releases/tag/v1.2.3' },
  };
  firstCommitShaResult = null;
  resolveDepsResult = [];
  capturedTagBody = undefined;
  capturedReleaseBody = undefined;
});

describe('git/release/create', () => {
  it('sets tag and release-url outputs', async () => {
    const { outputs } = await runTask(create, { params: baseParams });
    assert.equal(outputs['tag'], 'v1.2.3');
    assert.equal(outputs['release-url'], 'https://github.com/acme/my-repo/releases/tag/v1.2.3');
  });

  it('embeds version_id in the tag message', async () => {
    await runTask(create, { params: baseParams });
    assert.ok(String(capturedTagBody?.message).includes('version_id: 04tAAA'));
  });

  it('includes install link in release body by default', async () => {
    await runTask(create, { params: baseParams });
    assert.ok(String(capturedReleaseBody?.body).includes('installPackage'));
  });

  it('omits install link when install-link=false', async () => {
    await runTask(create, { params: { ...baseParams, 'install-link': false } });
    assert.equal(String(capturedReleaseBody?.body).includes('installPackage'), false);
  });

  it('marks release as prerelease', async () => {
    await runTask(create, { params: { ...baseParams, prerelease: true } });
    assert.equal(capturedReleaseBody?.prerelease, true);
  });

  it('uses custom body when provided', async () => {
    await runTask(create, { params: { ...baseParams, body: 'My notes' } });
    assert.ok(String(capturedReleaseBody?.body).includes('My notes'));
  });

  it('disables generate_release_notes when custom body is provided', async () => {
    await runTask(create, { params: { ...baseParams, body: 'My notes' } });
    assert.equal(capturedReleaseBody?.generate_release_notes, false);
  });

  it('anchors release notes against the previous production release', async () => {
    ghResponses['/repos/acme/my-repo/releases?per_page=30'] = [{ tag_name: 'v1.0.0', prerelease: false }];
    await runTask(create, { params: baseParams });
    assert.equal(capturedReleaseBody?.previous_tag_name, 'v1.0.0');
  });

  it('falls back to first commit SHA when no prior production release exists', async () => {
    firstCommitShaResult = 'oldest-sha';
    await runTask(create, { params: baseParams });
    assert.equal(capturedReleaseBody?.previous_tag_name, 'oldest-sha');
  });

  it('skips previous-tag anchoring for prereleases', async () => {
    ghResponses['/repos/acme/my-repo/releases?per_page=30'] = [{ tag_name: 'v1.0.0', prerelease: false }];
    await runTask(create, { params: { ...baseParams, prerelease: true } });
    assert.equal(capturedReleaseBody?.previous_tag_name, undefined);
  });

  it('includes resolved dependencies in the tag message', async () => {
    resolveDepsResult = [{ kind: 'package-id', versionId: '04tBBB', name: 'DepPkg' }];
    await runTask(create, {
      params: baseParams,
      context: {
        config: {
          project: {
            slug: 'test',
            git: { repoUrl: 'https://github.com/acme/my-repo' },
            package: {
              name: 'MyPkg',
              type: 'Managed',
              testPattern: '*_Test',
              dependencies: [{ versionId: '04tBBB' }],
            },
          },
          dir: '.ship',
        },
      },
    });
    assert.ok(String(capturedTagBody?.message).includes('04tBBB'));
  });

  it('throws ExpectedError when no token found', async () => {
    tokenValue = undefined;
    await assert.rejects(
      () => runTask(create, { params: baseParams }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No GitHub token')
    );
  });

  it('throws ExpectedError when no repo url configured', async () => {
    await assert.rejects(
      () => runTask(create, { params: { tag: 'v1.2.3', 'version-id': '04tAAA' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No repo URL')
    );
  });
});
