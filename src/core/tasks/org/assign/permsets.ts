/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
