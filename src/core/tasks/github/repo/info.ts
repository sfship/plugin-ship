import { getGithubToken } from '@plugin-ship/core/services/github.js';
import type { Task, TaskContext } from '@plugin-ship/core/task.js';

type GithubRepo = {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  open_issues_count: number;
  visibility: string;
};

/**
 * Fetches basic repository info from the GitHub API and logs it.
 * Reads the repo URL from `config.project.git.repoUrl`.
 * Uses the GitHub token stored by `sf ship service connect github`.
 */
export default {
  name: 'github/repo/info',
  description: 'Fetches and logs basic repository info from the GitHub API.',
  params: [
    {
      name: 'github-alias',
      type: 'string',
      required: false,
      description: 'GitHub token alias. Defaults to "default".',
    },
    {
      name: 'repo-url',
      type: 'string',
      required: false,
      description: 'GitHub repository URL. Falls back to config.project.git.repoUrl.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = String(params['github-alias'] ?? 'default');
    const token = getGithubToken(alias);
    if (!token) throw new Error(`No GitHub token found for alias "${alias}". Run: sf ship service connect github`);

    const repoUrl = flow.config.project.git?.repoUrl ?? String(params['repo-url'] ?? '');
    if (!repoUrl)
      throw new Error('No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.');

    const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (!match) throw new Error(`Could not parse GitHub owner/repo from URL: ${repoUrl}`);
    const [, owner, repo] = match;

    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'plugin-ship', Accept: 'application/vnd.github+json' },
    });

    if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);

    const data = (await resp.json()) as GithubRepo;

    flow.log(`Repo:            ${data.full_name}`);
    flow.log(`Description:     ${data.description ?? '(none)'}`);
    flow.log(`Default branch:  ${data.default_branch}`);
    flow.log(`Visibility:      ${data.visibility}`);
    flow.log(`Stars:           ${data.stargazers_count}`);
    flow.log(`Open issues/PRs: ${data.open_issues_count}`);
  },
} satisfies Task;
