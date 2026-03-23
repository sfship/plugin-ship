import { defineAction } from '../../../define-action.js';
import { type ActionArgs } from '../../../types.js';
import { getGithubToken } from '../../../services/github.js';

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
export default defineAction(async ({ config, log, params }: ActionArgs) => {
  const alias = String(params['github-alias'] ?? 'default');
  const token = getGithubToken(alias);
  if (!token) throw new Error(`No GitHub token found for alias "${alias}". Run: sf ship service connect github`);

  const repoUrl = config.project?.git?.repoUrl ?? String(params['repo-url'] ?? '');
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

  log(`Repo:           ${data.full_name}`);
  log(`Description:    ${data.description ?? '(none)'}`);
  log(`Default branch: ${data.default_branch}`);
  log(`Visibility:     ${data.visibility}`);
  log(`Stars:          ${data.stargazers_count}`);
  log(`Open issues/PRs: ${data.open_issues_count}`);
});
