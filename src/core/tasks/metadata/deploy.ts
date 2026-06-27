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
import { resolve } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../task.definition.schema.js';

export default {
  description: 'Deploys metadata to a target org using the Salesforce source deploy API.',
  params: [
    {
      name: 'source-dir',
      type: 'string',
      required: false,
      description: 'Path to the source directory to deploy. Defaults to "force-app".',
    },
    {
      name: 'target-org',
      type: 'string',
      required: false,
      description: 'Org alias or username to deploy to. Defaults to the SF CLI default target-org.',
    },
  ],
  async run({ flow, params }: TaskContext): Promise<void> {
    const sourceDir = resolve(process.cwd(), (params['source-dir'] as string | undefined) ?? 'force-app');
    const alias = flow.orgs.resolveAlias(params['target-org'] as string | undefined);
    const orgArgs = alias !== undefined ? ['--target-org', alias] : [];

    await flow.runCommand('project:deploy:start', ['--source-dir', sourceDir, ...orgArgs]);
    flow.log('Deployed successfully.');
  },
} satisfies TaskDefinition;
