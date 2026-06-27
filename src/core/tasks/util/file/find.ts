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
import { findFiles } from '../../../file.js';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';

export default {
  description: 'Finds files in a directory whose names match a glob pattern.',
  params: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'Directory to search, relative to the project root.',
    },
    {
      name: 'pattern',
      type: 'string',
      required: false,
      default: '*',
      description: 'Glob pattern matched against the filename without extension. Case-insensitive. Defaults to "*".',
    },
    {
      name: 'recursive',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Recurse into subdirectories. Defaults to true.',
    },
    {
      name: 'strip-extension',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Strip file extensions from results. Defaults to true.',
    },
  ],
  outputs: [
    {
      name: 'files',
      type: 'string',
      description: 'Comma-separated list of matching file names.',
    },
    {
      name: 'count',
      type: 'string',
      description: 'Number of matching files found.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const dir = resolve(flow.projectDir, params['path'] as string);
    const pattern = (params['pattern'] as string | undefined) ?? '*';
    const recursive = params['recursive'] !== false;
    const stripExtension = params['strip-extension'] !== false;

    const files = await findFiles(dir, { pattern, recursive, stripExtension });

    flow.log(`Found ${files.length} file(s) matching "${pattern}" in ${params['path'] as string}.`);
    output.set('files', files.join(','));
    output.set('count', String(files.length));
  },
} satisfies TaskDefinition;
