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
  description: 'Reads an environment variable into step outputs, for use in later steps or `if` gates.',
  params: [{ name: 'name', type: 'string', required: true, description: 'The environment variable name.' }],
  outputs: [
    { name: 'value', type: 'string', description: 'The variable value, or an empty string when unset.' },
    { name: 'exists', type: 'boolean', description: 'True if the variable is set, even to an empty string.' },
  ],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const name = params['name'] as string;
    const value = process.env[name];
    flow.log(`Environment variable ${name} is ${value === undefined ? 'not set' : 'set'}`);
    output.set('value', value ?? '');
    output.set('exists', value !== undefined);
  },
} satisfies TaskDefinition;
