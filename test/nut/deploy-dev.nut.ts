import { strict as assert } from 'node:assert';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

/** The scratch org the flow creates: `<project slug>:<scratch def name>`. */
const TARGET_ORG = 'mock-ship-project:dev';

type CountResult = { totalSize: number };

/** SOQL count against the flow's scratch org. */
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
    session = await TestSession.create({
      project: { gitClone: 'https://github.com/bdematt/Mock-Ship-Project.git' },
      devhubAuthStrategy: 'AUTH_URL',
    });

    execCmd('ship flow run deploy/dev', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    });
  });

  after(async () => {
    // The flow created the org, not TestSession, so session.clean() won't remove it.
    execCmd(`org delete scratch --target-org ${TARGET_ORG} --no-prompt`, { cli: 'sf' });
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
