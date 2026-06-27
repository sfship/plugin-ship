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

export default {
  description: 'Deletes a scratch org by alias. Passthrough for `sf org delete scratch`.',
  params: [{ name: 'alias', type: 'string', required: true, description: 'The scratch org alias to delete.' }],
  async run({ flow, params }: TaskContext): Promise<void> {
    const alias = flow.orgs.resolveAlias(params['alias'] as string);
    await flow.runCommand('org:delete:scratch', ['--target-org', alias, '--no-prompt']);
    flow.log(`Deleted scratch org: ${alias}`);
  },
} satisfies TaskDefinition;
