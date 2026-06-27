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
import { resolvePassthroughArgs } from '../../../task.param.js';

export default {
  description: 'Installs a package version into a Salesforce org. Passthrough for `sf package install`.',
  params: [
    {
      name: 'version-id',
      type: 'string',
      required: true,
      description: 'The 04t package version ID to install.',
    },
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to install the package into. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'wait',
      type: 'number',
      required: false,
      default: 10,
      description: 'Minutes to wait for installation to complete. Defaults to 10.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const versionId = params['version-id'] as string;
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const argv = resolvePassthroughArgs(params, {
      '--target-org': alias ?? null,
      '--package': versionId,
      '--version-id': null,
    });
    await flow.runCommand('package:install', argv);
    flow.log(`Package ${versionId} installed successfully.`);
  },
} satisfies TaskDefinition;
