import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import esmock from 'esmock';
import type { OrgRegistry as OrgRegistryType } from '../../src/core/org.registry.js';

const ORGS_DIR = '/fake/orgs';
const validDef = { edition: 'Developer', orgName: 'Test Org' };
const files = new Map<string, string>();

let orgCreateStub: () => Promise<object> = async () => ({});

const { OrgRegistry }: { OrgRegistry: typeof OrgRegistryType } = await esmock('../../src/core/org.registry.js', {
  '../../src/core/file.js': {
    fileExists: (path: string) => files.has(path),
    readText: (path: string) => files.get(path),
  },
  '@salesforce/core': {
    Org: { create: async () => orgCreateStub() },
  },
});

beforeEach(() => {
  files.clear();
  orgCreateStub = async () => ({});
});

function putFile(alias: string, content: object): void {
  files.set(resolve(ORGS_DIR, `${alias}.json`), JSON.stringify(content));
}

describe('OrgRegistry.resolveAlias', () => {
  it('returns the alias as-is when no def file exists', () => {
    assert.equal(new OrgRegistry(ORGS_DIR, 'myproject').resolveAlias('dev'), 'dev');
  });

  it('returns a qualified alias when a def file exists and project name is set', () => {
    putFile('dev', validDef);
    assert.equal(new OrgRegistry(ORGS_DIR, 'myproject').resolveAlias('dev'), 'myproject:dev');
  });

  it('returns the alias as-is when a def file exists but no project name is set', () => {
    putFile('dev', validDef);
    assert.equal(new OrgRegistry(ORGS_DIR).resolveAlias('dev'), 'dev');
  });
});

describe('OrgRegistry.getDef', () => {
  it('reads and returns a valid scratch org definition', () => {
    putFile('dev', validDef);
    const def = new OrgRegistry(ORGS_DIR).getDef('dev');
    assert.equal(def.edition, 'Developer');
    assert.equal(def.orgName, 'Test Org');
  });

  it('throws when no def file exists for the alias', () => {
    assert.throws(
      () => new OrgRegistry(ORGS_DIR).getDef('missing'),
      /No scratch org definition found for alias "missing"/
    );
  });

  it('caches the def after the first read', () => {
    putFile('dev', validDef);
    const registry = new OrgRegistry(ORGS_DIR);
    assert.equal(registry.getDef('dev'), registry.getDef('dev'));
  });
});

describe('OrgRegistry.getOrg', () => {
  it('creates and returns an Org instance', async () => {
    putFile('dev', validDef);
    const fakeOrg = {};
    orgCreateStub = async () => fakeOrg;
    const org = await new OrgRegistry(ORGS_DIR).getOrg('dev');
    assert.equal(org, fakeOrg);
  });

  it('returns the cached instance on subsequent calls', async () => {
    putFile('dev', validDef);
    let callCount = 0;
    orgCreateStub = async () => {
      callCount++;
      return {};
    };
    const registry = new OrgRegistry(ORGS_DIR);
    await registry.getOrg('dev');
    await registry.getOrg('dev');
    assert.equal(callCount, 1);
  });
});
