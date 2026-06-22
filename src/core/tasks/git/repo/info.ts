import { getGithubToken, normalizeRepo, fetchRepoInfo } from '../../../service.github.js';
import type { TaskDefinition, TaskContext } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';

export default {
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
    if (!token)
      throw new ExpectedError(`No GitHub token found for alias "${alias}". Run: sf ship service connect github`);

    const repoUrl = (params['repo-url'] as string | undefined) ?? flow.config.project.git?.repoUrl;
    if (!repoUrl)
      throw new ExpectedError(
        'No repo URL. Set config.project.git.repoUrl in ship.yml or pass --param repo-url=<url>.'
      );

    const data = await fetchRepoInfo(normalizeRepo(repoUrl), token);

    flow.log(`Repo:            ${data.full_name}`);
    flow.log(`Description:     ${data.description ?? '(none)'}`);
    flow.log(`Default branch:  ${data.default_branch}`);
    flow.log(`Visibility:      ${data.visibility}`);
  },
} satisfies TaskDefinition;
