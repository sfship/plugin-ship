import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';
import { withSuppressedStdout } from '../../../stdout.js';

type AssignPermsetResult = {
  successes?: Array<{ name: string }>;
  failures?: Array<{ name: string; message: string }>;
};

export default {
  description:
    'Assigns permission sets and/or permission set groups to a user. Defaults to the list in ship.yml under project.package.permsets.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'permsets',
      type: 'string',
      required: false,
      description:
        'Comma-separated permission set or permission set group API names. Defaults to project.package.permsets in ship.yml.',
    },
    {
      name: 'username',
      type: 'string',
      required: false,
      description: 'Username to assign to. Defaults to the org running user.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);

    const namesParam = params['permsets'] as string | undefined;
    const names = namesParam
      ? namesParam
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
      : flow.config.project.package?.permsets ?? [];

    if (names.length === 0) {
      flow.log('No permission sets configured, skipping.');
      return;
    }

    const argv: string[] = ['--json'];
    if (alias !== undefined) argv.push('--target-org', alias);
    for (const name of names) argv.push('--name', name);
    if (params['username']) argv.push('--on-behalf-of', params['username'] as string);

    const result = (await withSuppressedStdout(() =>
      flow.runCommand('org:assign:permset', argv)
    )) as AssignPermsetResult;

    // Reassigning perm sets reports as a failure, so we filter those out
    const realFailures = (result.failures ?? []).filter(
      (f) => !f.message.includes('Duplicate PermissionSetAssignment')
    );
    if (realFailures.length > 0) {
      throw new ExpectedError(
        `Failed to assign permission sets:\n${realFailures.map((f) => `  ${f.name}: ${f.message}`).join('\n')}`
      );
    }

    flow.log(`Assigned ${names.length} permission set(s) to ${alias ?? 'default org'}.`);
  },
} satisfies TaskDefinition;
