import type { TaskContext, TaskDefinition } from '../../../task.js';
import { resolvePassthroughArgs } from '../../../task.param.js';
import { ExpectedError } from '../../../error.js';

// Default --wait value in minutes
const DEFAULT_WAIT_TIME = 15;

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
      required: false,
      description: 'Org alias or username to run tests against. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'test-level',
      type: 'string',
      required: false,
      description:
        'Apex test level. Defaults to "RunSpecifiedTests" when class-names is set, otherwise "RunLocalTests".',
    },
    {
      name: 'class-names',
      type: 'string',
      required: false,
      description: 'Comma-separated test class names. Required when test-level is "RunSpecifiedTests".',
    },
    {
      name: 'namespace',
      type: 'string',
      required: false,
      description:
        'Namespace prefix to prepend to each class name. Defaults to project.package.namespace from ship.yml.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      default: DEFAULT_WAIT_TIME,
      description: `Minutes to wait for the test run to complete. Defaults to ${DEFAULT_WAIT_TIME}`,
    },
    {
      name: 'min-coverage',
      type: 'number',
      required: false,
      description: 'Minimum org-wide coverage percentage (0–100). Fails the step if not met.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);

    const rawClassNames = params['class-names'] as string | undefined;
    const namespace = params['namespace'] as string | undefined;
    const classNames =
      rawClassNames && namespace
        ? rawClassNames
            .split(',')
            .map((c) => (c.includes('.') ? c.trim() : `${namespace}.${c.trim()}`))
            .join(',')
        : rawClassNames;

    const effectiveTestLevel =
      (params['test-level'] as string | undefined) ?? (classNames ? 'RunSpecifiedTests' : 'RunLocalTests');

    const wait = (params['wait'] as number | undefined) ?? DEFAULT_WAIT_TIME;
    const argv = resolvePassthroughArgs(params, {
      '--target-org': alias ?? null,
      '--tests': classNames ?? null,
      '--class-names': null,
      '--namespace': null,
      '--test-level': effectiveTestLevel ?? null,
      '--wait': String(wait),
      '--min-coverage': null,
      '--code-coverage': params['min-coverage'] !== undefined ? 'true' : null,
    });

    flow.log('Running Apex tests...');
    const result = (await flow.runCommand('apex:run:test', argv)) as TestRunResult;
    const { summary } = result;
    if (!summary) {
      throw new ExpectedError(
        'Test run did not complete within the wait period. Increase the `wait` param or retrieve results manually with `sf apex get test`.'
      );
    }
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
