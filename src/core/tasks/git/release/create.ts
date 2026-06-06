import { getGithubToken, normalizeRepo } from '../../../service.github.js';
import { resolveDependencies } from '../../../package.resolver.js';
import type { TaskContext, TaskDefinition } from '../../../task.js';
import { ExpectedError } from '../../../util.error.js';

type GitTagObject = { sha: string };
type Branch = { commit: { sha: string } };
type Repo = { default_branch: string };
type Release = { html_url: string };

async function gh<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'plugin-ship',
    Accept: 'application/vnd.github+json',
  };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  const resp = await fetch(`https://api.github.com${path}`, {
    method: init?.method,
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new ExpectedError(`GitHub API ${resp.status} ${resp.statusText} on ${path}: ${text}`);
  }
  return resp.json() as Promise<T>;
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
    const releaseBody = customBody ?? '';
    const alias = String(params['github-alias'] ?? 'default');

    const token = getGithubToken(alias);
    if (!token) {
      throw new ExpectedError(`No GitHub token found for alias "${alias}". Run: sf ship service connect github`);
    }

    const repoUrl = flow.config.project.git?.repoUrl ?? String(params['repo-url'] ?? '');
    if (!repoUrl) {
      throw new ExpectedError(
        'No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.'
      );
    }
    const repo = normalizeRepo(repoUrl);

    // Resolve commit SHA to tag.
    const target = params['target'] as string | undefined;
    let commitSha: string;
    if (target && /^[0-9a-f]{40}$/i.test(target)) {
      commitSha = target;
    } else {
      let branchName = target;
      if (!branchName) {
        const repoInfo = await gh<Repo>(token, `/repos/${repo}`);
        branchName = repoInfo.default_branch;
      }
      const branchInfo = await gh<Branch>(token, `/repos/${repo}/branches/${branchName}`);
      commitSha = branchInfo.commit.sha;
    }

    // Flatten dependencies into the annotation so downstream resolution is one-shot.
    const depsForAnnotation: Array<{ version_id: string; package_name?: string }> = [];
    const deps = flow.config.dependencies ?? [];
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
        tagger: {
          name: 'plugin-ship',
          email: 'noreply@plugin-ship',
          date: new Date().toISOString(),
        },
      },
    });

    flow.log(`Creating tag reference refs/tags/${tagName}...`);
    await gh(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/tags/${tagName}`, sha: tagObj.sha },
    });

    flow.log(`Creating GitHub release ${tagName}...`);
    const release = await gh<Release>(token, `/repos/${repo}/releases`, {
      method: 'POST',
      body: {
        // eslint-disable-next-line camelcase
        tag_name: tagName,
        name: releaseName,
        body: releaseBody,
        prerelease,
        // eslint-disable-next-line camelcase
        generate_release_notes: generateReleaseNotes,
      },
    });

    flow.log(`Released: ${release.html_url}`);
    output.set('tag', tagName);
    output.set('release-url', release.html_url);
  },
} satisfies TaskDefinition;
