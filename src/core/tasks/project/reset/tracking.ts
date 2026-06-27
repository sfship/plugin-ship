/*
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
  description: 'Resets local and remote source tracking for an org. Passthrough for `sf project reset tracking`.',
  params: [
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to reset source tracking for. Defaults to the SF CLI default target-org.',
    },
    {
      name: 'revision',
      type: 'number',
      required: false,
      description: 'SourceMember revision counter number to reset tracking to. Defaults to the latest.',
    },
    {
      name: 'no-prompt',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Skip the confirmation prompt. Defaults to true so the step never blocks a flow.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const argv = resolvePassthroughArgs(params, { '--target-org': alias ?? null });
    await flow.runCommand('project:reset:tracking', argv);
    flow.log(`Reset source tracking for ${alias ?? 'default org'}.`);
  },
} satisfies TaskDefinition;
