import { join } from 'node:path';
import { walkFiles, replaceTokens, buildTokenMap } from './util.token.js';
import { normalizeRepo, downloadDir } from './service.github.js';
import type { MetadataStep } from './package.resolver.js';

/**
 * Downloads a CCI `unpackaged/pre` or `unpackaged/post` subfolder from GitHub,
 * injects namespace tokens, and deploys it to the target org via `project:deploy:start`.
 */
export async function deployMetadataStep(
  step: MetadataStep,
  targetOrg: string,
  shipDir: string,
  log: (msg: string) => void,
  runCommand: (id: string, argv: string[]) => Promise<unknown>
): Promise<void> {
  const repo = normalizeRepo(step.repoUrl);
  const slug = repo.replace('/', '_');
  const localDir = join(shipDir, 'tmp', 'deps', slug, step.subfolder);

  log(`Downloading ${step.repoUrl}/${step.subfolder}@${step.tag}...`);
  await downloadDir(repo, step.tag, step.subfolder, localDir);

  const files = await walkFiles(localDir);
  await Promise.all(files.map((f) => replaceTokens(f, buildTokenMap(step.namespace))));

  log(`Deploying ${step.subfolder}...`);
  await runCommand('project:deploy:start', ['--metadata-dir', localDir, '--target-org', targetOrg]);
}
