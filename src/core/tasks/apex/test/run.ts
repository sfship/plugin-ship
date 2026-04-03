import type { Task, TaskContext } from '@plugin-ship/core/task.js';

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
 * Polls until the job completes, then reports results and optionally enforces a coverage threshold.
 */
export default {
  name: 'apex/test/run',
  description: 'Runs Apex tests against the target org using the Tooling API.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: true,
      description: 'Org alias or username to run tests against.',
    },
    {
      name: 'test-level',
      type: 'string',
      required: false,
      description: '"RunLocalTests" | "RunAllTestsInOrg" | "RunSpecifiedTests". Defaults to "RunAllTestsInOrg".',
    },
    {
      name: 'class-names',
      type: 'string',
      required: false,
      description: 'Comma-separated list of test class names. Required when test-level is "RunSpecifiedTests".',
    },
    {
      name: 'poll-interval',
      type: 'number',
      required: false,
      description: 'Polling interval in milliseconds. Defaults to 3000.',
    },
    {
      name: 'min-coverage',
      type: 'number',
      required: false,
      description: 'Minimum org-wide coverage percentage (0–100). Fails the step if not met.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string);
    const org = await flow.orgs.getOrg(alias);
    const connection = org.getConnection();

    const testLevel = ((params['test-level'] as string | undefined) ?? 'RunAllTestsInOrg') as TestLevel;
    const pollInterval = (params['poll-interval'] as number | undefined) ?? 3000;
    const minCoverage = params['min-coverage'] as number | undefined;

    const request =
      testLevel === 'RunSpecifiedTests'
        ? {
            tests: ((params['class-names'] as string | undefined) ?? '')
              .split(',')
              .map((c) => ({ className: c.trim() })),
            testLevel,
            skipCodeCoverage: false,
          }
        : { testLevel, skipCodeCoverage: false };

    flow.log(`Running Apex tests (${testLevel})...`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const jobId = await connection.tooling.runTestsAsynchronous(request);
    if (!jobId) throw new Error('Failed to start test run — no job ID returned.');

    flow.log(`Test job started: ${String(jobId)}`);

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
        (acc, r) => ({ ...acc, [r.Status]: (acc[r.Status] ?? 0) + 1 }),
        {}
      );
      flow.log(
        `Tests running... (${Object.entries(counts)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')})`
      );
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

    flow.log(
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

    flow.log(`All ${passed} tests passed.`);

    if (minCoverage !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const coverage = await connection.tooling.query<ApexCodeCoverage>(
        'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate'
      );
      const totalCovered = coverage.records.reduce((sum, r) => sum + r.NumLinesCovered, 0);
      const totalLines = coverage.records.reduce((sum, r) => sum + r.NumLinesCovered + r.NumLinesUncovered, 0);
      const pct = totalLines > 0 ? Math.floor((totalCovered / totalLines) * 100) : 0;
      flow.log(`Org-wide coverage: ${pct}%`);
      if (pct < minCoverage) {
        throw new Error(`Coverage ${pct}% is below the required minimum of ${minCoverage}%.`);
      }
    }
  },
} satisfies Task;
