import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';
import { ExpectedError } from '../../../util.error.js';

type TestRunResult = {
  summary: {
    outcome: string;
    testsRan: number;
    passing: number;
    failing: number;
    orgWideCoverage?: string;
  };
};

export default {
  description: 'Runs Apex tests against the target org. Passthrough for `sf apex run test`.',
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
      description: 'Comma-separated test class names. Required when test-level is "RunSpecifiedTests".',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      description: 'Minutes to wait for the test run to complete. Defaults to 10.',
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
    const wait = (params['wait'] as number | undefined) ?? 10;
    const argv = resolvePassthroughArgs(params, {
      '--target-org': alias,
      '--tests': (params['class-names'] as string | undefined) ?? null,
      '--class-names': null,
      '--wait': String(wait),
      '--min-coverage': null,
      '--code-coverage': params['min-coverage'] !== undefined ? 'true' : null,
    });

    const result = (await flow.runCommand('apex:run:test', argv)) as TestRunResult;
    const { summary } = result;
    flow.log(`Tests run: ${summary.testsRan} | Passed: ${summary.passing} | Failed: ${summary.failing}`);

    const minCoverage = params['min-coverage'] as number | undefined;
    if (minCoverage !== undefined && summary.orgWideCoverage !== undefined) {
      const pct = parseInt(summary.orgWideCoverage, 10);
      if (pct < minCoverage) {
        throw new ExpectedError(`Coverage ${pct}% is below the required minimum of ${minCoverage}%.`);
      }
      flow.log(`Org-wide coverage: ${summary.orgWideCoverage}`);
    }
  },
} satisfies TaskDefinition;
