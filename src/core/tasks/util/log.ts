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
import type { TaskContext, TaskDefinition } from '../../task.definition.schema.js';

/** Logs a message to the flow output. Useful for progress indicators and debug output in flows. */
export default {
  description: 'Logs a message to the flow output.',
  params: [{ name: 'message', type: 'string', required: true, description: 'The message to log.' }],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params }: TaskContext): Promise<void> {
    flow.log(params['message'] as string);
  },
} satisfies TaskDefinition;
