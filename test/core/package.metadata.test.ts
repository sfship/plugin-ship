import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import esmock from 'esmock';
import type { deployMetadataStep as DeployFn } from '../../src/core/package.metadata.js';
import type { MetadataStep } from '../../src/core/package.resolver.js';

type Module = { deployMetadataStep: typeof DeployFn };

let downloadDirCall: [string, string, string, string] | undefined;
let walkFilesStub: (dir: string) => Promise<string[]> = async () => [];
const replacedPaths: string[] = [];
let buildTokenMapStub: (ns: string) => Record<string, string> = () => ({});

const { deployMetadataStep }: Module = await esmock('../../src/core/package.metadata.js', {
  '../../src/core/service.github.js': {
    normalizeRepo: (r: string) => r.replace('https://github.com/', ''),
    downloadDir: (repo: string, tag: string, subfolder: string, localDir: string) => {
      downloadDirCall = [repo, tag, subfolder, localDir];
    },
  },
  '../../src/core/file.js': {
    walkFiles: (dir: string) => walkFilesStub(dir),
  },
  '../../src/core/package.namespace.js': {
    replaceTokens: (path: string) => {
      replacedPaths.push(path);
    },
    buildTokenMap: (ns: string) => buildTokenMapStub(ns),
  },
});

const step: MetadataStep = {
  kind: 'metadata',
  repoUrl: 'https://github.com/org/repo',
  subfolder: 'unpackaged/pre/step1',
  namespace: 'myns',
  tag: 'v1.0.0',
  versionId: '04tAAAAAAAAAAAAAAA',
};

const SHIP_DIR = '/ship';
const TARGET_ORG = 'myorg';
const localDir = join(SHIP_DIR, 'tmp', 'deps', 'org_repo', step.subfolder);

const logMessages: string[] = [];
let runCommandCall: [string, string[]] | undefined;

beforeEach(() => {
  downloadDirCall = undefined;
  walkFilesStub = async () => [];
  replacedPaths.length = 0;
  buildTokenMapStub = () => ({});
  logMessages.length = 0;
  runCommandCall = undefined;
});

function runCommand(id: string, argv: string[]): Promise<unknown> {
  runCommandCall = [id, argv];
  return Promise.resolve();
}

function log(msg: string): void {
  logMessages.push(msg);
}

describe('deployMetadataStep', () => {
  it('downloads the subfolder from github with the correct args', async () => {
    await deployMetadataStep(step, TARGET_ORG, SHIP_DIR, log, runCommand);
    assert.deepEqual(downloadDirCall, ['org/repo', step.tag, step.subfolder, localDir]);
  });

  it('calls replaceTokens on every file returned by walkFiles', async () => {
    const files = [`${localDir}/a.xml`, `${localDir}/b.xml`];
    walkFilesStub = async () => files;
    await deployMetadataStep(step, TARGET_ORG, SHIP_DIR, log, runCommand);
    assert.deepEqual(replacedPaths.sort(), files.slice().sort());
  });

  it('passes the step namespace to buildTokenMap', async () => {
    let capturedNs: string | undefined;
    buildTokenMapStub = (ns) => {
      capturedNs = ns;
      return {};
    };
    walkFilesStub = async () => [`${localDir}/file.xml`];
    await deployMetadataStep(step, TARGET_ORG, SHIP_DIR, log, runCommand);
    assert.equal(capturedNs, step.namespace);
  });

  it('deploys to the target org with the correct metadata dir', async () => {
    await deployMetadataStep(step, TARGET_ORG, SHIP_DIR, log, runCommand);
    assert.deepEqual(runCommandCall, [
      'project:deploy:start',
      ['--metadata-dir', localDir, '--target-org', TARGET_ORG],
    ]);
  });

  it('logs a download message and a deploy message', async () => {
    await deployMetadataStep(step, TARGET_ORG, SHIP_DIR, log, runCommand);
    assert.ok(logMessages.some((m) => m.includes('Downloading')));
    assert.ok(logMessages.some((m) => m.includes('Deploying')));
  });
});
