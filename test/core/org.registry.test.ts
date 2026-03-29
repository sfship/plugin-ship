import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';

const validDef = {
  edition: 'Developer',
  orgName: 'Test Org',
};

let orgsDir: string;

beforeEach(() => {
  orgsDir = mkdtempSync(join(tmpdir(), 'plugin-ship-test-'));
});

afterEach(() => {
  rmSync(orgsDir, { recursive: true, force: true });
});

describe('OrgRegistry.resolveAlias', () => {
  it('returns the alias as-is when no def file exists', () => {
    const registry = new OrgRegistry(orgsDir, 'myproject');
    assert.equal(registry.resolveAlias('dev'), 'dev');
  });

  it('returns a qualified alias when a def file exists and project name is set', () => {
    writeFileSync(join(orgsDir, 'dev.json'), JSON.stringify(validDef));
    const registry = new OrgRegistry(orgsDir, 'myproject');
    assert.equal(registry.resolveAlias('dev'), 'myproject:dev');
  });

  it('returns the alias as-is when a def file exists but no project name is set', () => {
    writeFileSync(join(orgsDir, 'dev.json'), JSON.stringify(validDef));
    const registry = new OrgRegistry(orgsDir);
    assert.equal(registry.resolveAlias('dev'), 'dev');
  });
});

describe('OrgRegistry.getDef', () => {
  it('reads and returns a valid scratch org definition', () => {
    writeFileSync(join(orgsDir, 'dev.json'), JSON.stringify(validDef));
    const registry = new OrgRegistry(orgsDir, 'myproject');
    const def = registry.getDef('dev');
    assert.equal(def.edition, 'Developer');
    assert.equal(def.orgName, 'Test Org');
  });

  it('throws when no def file exists for the alias', () => {
    const registry = new OrgRegistry(orgsDir, 'myproject');
    assert.throws(() => registry.getDef('missing'), /No scratch org definition found for alias "missing"/);
  });

  it('caches the def after the first read', () => {
    writeFileSync(join(orgsDir, 'dev.json'), JSON.stringify(validDef));
    const registry = new OrgRegistry(orgsDir, 'myproject');
    const first = registry.getDef('dev');
    const second = registry.getDef('dev');
    assert.equal(first, second);
  });
});
