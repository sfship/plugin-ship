import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { Org } from '@salesforce/core';
import { ExpectedError } from './util.error.js';
import { walkFiles, replaceTokens, buildTokenMap } from './util.token.js';
import { normalizeRepo, downloadDir } from './service.github.js';
import type { MetadataStep } from './package.resolver.js';

type DeployResult = {
  done: boolean;
  success: boolean;
  status: string;
  errorMessage?: string;
  details?: {
    componentFailures?: Array<{ fileName: string; problem: string }> | { fileName: string; problem: string };
  };
};

/** Zips `localDir` into a Metadata API-compatible archive. */
async function zipDir(localDir: string): Promise<Buffer> {
  const zip = new JSZip();
  const files = await walkFiles(localDir);
  await Promise.all(
    files.map(async (file) => {
      const rel = relative(localDir, file).replace(/\\/g, '/');
      zip.file(rel, await readFile(file));
    })
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Downloads a CCI `unpackaged/pre` or `unpackaged/post` subfolder from GitHub,
 * injects namespace tokens, and deploys it to `org` via the Metadata API.
 */
export async function deployMetadataStep(
  step: MetadataStep,
  org: Org,
  shipDir: string,
  log: (msg: string) => void
): Promise<void> {
  const repo = normalizeRepo(step.repoUrl);
  const slug = repo.replace('/', '_');
  const localDir = join(shipDir, 'tmp', 'deps', slug, step.subfolder);

  log(`Downloading ${step.repoUrl}/${step.subfolder}@${step.tag}...`);
  await downloadDir(repo, step.tag, step.subfolder, localDir);

  const files = await walkFiles(localDir);
  await Promise.all(files.map((f) => replaceTokens(f, buildTokenMap(step.namespace))));

  log(`Deploying ${step.subfolder}...`);
  const conn = org.getConnection();
  const zipBuffer = await zipDir(localDir);

  const deployResult = await conn.metadata.deploy(zipBuffer, { rollbackOnError: true, singlePackage: true });

  const POLL_INTERVAL_MS = 5000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    // eslint-disable-next-line no-await-in-loop
    const status = (await conn.metadata.checkDeployStatus(deployResult.id, true)) as DeployResult;

    if (!status.done) {
      log(`Deploy ${status.status}...`);
      continue;
    }

    if (status.success) {
      log(`Deployed ${step.subfolder} successfully.`);
      return;
    }

    const failures = [status.details?.componentFailures ?? []].flat();
    const messages = failures.map((f) => `  ${f.fileName}: ${f.problem}`).join('\n');
    throw new ExpectedError(`Metadata deployment failed for ${step.subfolder}:\n${messages}`);
  }
}
