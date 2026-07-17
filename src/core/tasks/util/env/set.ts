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

export default {
  description:
    'Sets environment variables for the remainder of the flow run. Useful with sfdx-project.json `replacements` entries that use `replaceWithEnv`.',
  params: [
    {
      name: 'vars',
      type: 'record',
      required: true,
      description: 'Map of environment variable names to values. Values may be empty strings.',
    },
  ],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params }: TaskContext): Promise<void> {
    // Values may be sensitive; log names only.
    for (const [name, value] of Object.entries(params['vars'] as Record<string, string>)) {
      process.env[name] = value;
      flow.log(`Set environment variable ${name}`);
    }
  },
} satisfies TaskDefinition;
