/* eslint-disable no-console */
import { strict as assert } from 'node:assert';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

/**
 * Tests the `deploy/dev` flow
 *
 * Runs against the plugin's own `bin/run.js` (testkit's default executable).
 *
 * Prerequisites:
 * - `yarn build` so `lib/` exists for `bin/run.js`.
 * - A dev hub for testkit's AUTO strategy. TestSession authenticates into an
 * isolated stubbed home and does NOT inherit your machine's default hub.
 * Set `TESTKIT_AUTH_URL` to the hub's sfdx auth URL.
 */

/** The scratch org the flow creates: `<project slug>:<scratch def name>`. */
const TARGET_ORG = 'mock-ship-project:dev';

type CountResult = { totalSize: number };

/** Runs a SOQL count against the flow's scratch org and returns the row count. */
function count(soql: string): number {
  const result = execCmd<CountResult>(`data query --query "${soql}" --target-org ${TARGET_ORG} --json`, {
    cli: 'sf',
    ensureExitCode: 0,
  });
  return result.jsonOutput?.result.totalSize ?? -1;
}

describe('deploy/dev flow (NUT)', () => {
  let session: TestSession;

  before(async () => {
    const raw = process.env.TESTKIT_AUTH_URL ?? '';
    console.log('len', raw.length, 'startsForce', raw.startsWith('force://'), 'tail', JSON.stringify(raw.slice(-3)));
    session = await TestSession.create({
      project: { gitClone: 'https://github.com/bdematt/Mock-Ship-Project.git' },
      devhubAuthStrategy: 'AUTH_URL',
    });

    // Verify devhub set before running the flow.
    const result = execCmd<{
      devHubs?: Array<{ isDefaultDevHubUsername?: boolean }>;
      nonScratchOrgs?: Array<{ isDevHub?: boolean; isDefaultDevHubUsername?: boolean }>;
    }>('org list --json', { ensureExitCode: 0 }).jsonOutput?.result;

    const hub = result?.devHubs?.[0] ?? result?.nonScratchOrgs?.find((o) => o.isDevHub);

    assert.ok(
      hub?.isDefaultDevHubUsername,
      'AUTO did not set a default dev hub — is TESTKIT_AUTH_URL set in this environment?'
    );

    execCmd('ship flow run deploy/dev', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    });
  });

  after(async () => {
    // The flow created the org, not TestSession, so session.clean() won't remove
    // it — delete it explicitly to avoid leaking a 30-day scratch org per run.
    execCmd(`org delete scratch --target-org ${TARGET_ORG} --no-prompt`);
    await session?.clean();
  });

  it('deploys the project source to the scratch org', () => {
    assert.equal(count("SELECT Id FROM ApexClass WHERE Name = 'Calculator'"), 1);
  });

  it('imports seed data via the default .ship/data/plan.json', () => {
    assert.equal(count('SELECT Id FROM bd1887__Mock_Object__c'), 3);
  });

  it("assigns the project's permission set", () => {
    assert.ok(
      count("SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'Mock_Extension_Perm_Set'") >= 1
    );
  });
});
