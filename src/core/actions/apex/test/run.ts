import { defineAction } from '@plugin-ship/core/define-action.js';
import { type ActionArgs } from '@plugin-ship/core/types.js';
import { resolveOrgAlias, getShipDir } from '@plugin-ship/core/utils.js';

type TestLevel = 'RunLocalTests' | 'RunAllTestsInOrg' | 'RunSpecifiedTests';

type ApexTestQueueItem = {
  Status: 'Queued' | 'Processing' | 'Aborted' | 'Completed' | 'Failed' | 'Preparing' | 'Holding';
};

type ApexTestResult = {
  ApexClass: { Name: string };
  MethodName: string;
  Outcome: 'Pass' | 'Fail' | 'CompileFail' | 'Skip';
  Message: string | null;
  StackTrace: string | null;
  RunTime: number;
};

type AsyncApexJob = {
  Status: string;
  ExtendedStatus: string | null;
};

type ApexCodeCoverage = {
  ApexClassOrTrigger: { Name: string };
  NumLinesCovered: number;
  NumLinesUncovered: number;
};

/**
 * Runs Apex tests against the target org using the Tooling API (async).
 *
 * Params:
 * - `target-org` — org alias or username. Falls back to `context.get('targetOrg')`.
 * - `test-level` — `RunLocalTests` | `RunAllTestsInOrg` | `RunSpecifiedTests`. Defaults to `RunAllTestsInOrg`.
 * - `class-names` — comma-separated list of test class names (required when `test-level` is `RunSpecifiedTests`).
 * - `poll-interval` — polling interval in milliseconds. Defaults to `3000`.
 * - `min-coverage` — minimum org-wide coverage percentage (0-100). Fails if not met. Defaults to no check.
 */
export default defineAction(async ({ config, cwd, getOrg, get, params, log }: ActionArgs) => {
  const rawAlias = String(get('targetOrg') ?? params['target-org'] ?? '');
  if (!rawAlias) throw new Error('No target org. Set targetOrg via a prior step or pass --param target-org=<alias>.');

  const shipDir = getShipDir(cwd, config);
  const alias = resolveOrgAlias(rawAlias, shipDir, config.project?.name);
  const org = await getOrg(alias);
  const connection = org.getConnection();

  const testLevel = String(params['test-level'] ?? 'RunAllTestsInOrg') as TestLevel;
  const pollInterval = params['poll-interval'] ? Number(params['poll-interval']) : 3000;

  const minCoverage = params['min-coverage'] !== undefined ? Number(params['min-coverage']) : undefined;

  const request =
    testLevel === 'RunSpecifiedTests'
      ? {
          tests: String(params['class-names'] ?? '')
            .split(',')
            .map((c) => ({ className: c.trim() })),
          testLevel,
          skipCodeCoverage: false,
        }
      : { testLevel, skipCodeCoverage: false };

  log(`Running Apex tests (${testLevel})...`);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const jobId = await connection.tooling.runTestsAsynchronous(request);
  if (!jobId) throw new Error('Failed to start test run — no job ID returned.');

  log(`Test job started: ${String(jobId)}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, pollInterval));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-await-in-loop
    const job = (await connection.tooling.retrieve('AsyncApexJob', String(jobId))) as AsyncApexJob;

    if (['Completed', 'Failed', 'Aborted'].includes(job.Status)) break;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-await-in-loop
    const queueItems = await connection.tooling.query<ApexTestQueueItem>(
      `SELECT Status FROM ApexTestQueueItem WHERE ParentJobId = '${String(jobId)}'`
    );
    const counts = queueItems.records.reduce<Record<string, number>>(
      (acc, r) => ({
        ...acc,
        [r.Status]: (acc[r.Status] ?? 0) + 1,
      }),
      {}
    );
    const summary = Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    log(`Tests running... (${summary})`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const results = await connection.tooling.query<ApexTestResult>(
    `SELECT ApexClass.Name, MethodName, Outcome, Message, StackTrace, RunTime FROM ApexTestResult WHERE AsyncApexJobId = '${String(
      jobId
    )}'`
  );

  const failures = results.records.filter((r) => r.Outcome === 'Fail' || r.Outcome === 'CompileFail');
  const passed = results.records.filter((r) => r.Outcome === 'Pass').length;
  const totalTime = results.records.reduce((sum, r) => sum + r.RunTime, 0);

  log(
    `Tests run: ${results.records.length} | Passed: ${passed} | Failures: ${failures.length} | Time: ${(
      totalTime / 1000
    ).toFixed(1)}s`
  );

  if (failures.length > 0) {
    const summary = failures
      .map((f) => `  ✗ ${f.ApexClass.Name}.${f.MethodName}\n    ${f.Message ?? ''}\n    ${f.StackTrace ?? ''}`)
      .join('\n');
    throw new Error(`${failures.length} Apex test(s) failed:\n${summary}`);
  }

  log(`All ${passed} tests passed.`);

  if (minCoverage !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const coverage = await connection.tooling.query<ApexCodeCoverage>(
      'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate'
    );
    const totalCovered = coverage.records.reduce((sum, r) => sum + r.NumLinesCovered, 0);
    const totalLines = coverage.records.reduce((sum, r) => sum + r.NumLinesCovered + r.NumLinesUncovered, 0);
    const pct = totalLines > 0 ? Math.floor((totalCovered / totalLines) * 100) : 0;
    log(`Org-wide coverage: ${pct}%`);
    if (pct < minCoverage) {
      throw new Error(`Coverage ${pct}% is below the required minimum of ${minCoverage}%.`);
    }
  }
});
