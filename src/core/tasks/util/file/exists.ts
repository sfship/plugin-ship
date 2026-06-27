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
import { resolve } from 'node:path';
import { pathExists } from '../../../file.js';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';

export default {
  description:
    'Checks whether a file or directory exists. Mirrors `test -e` / `-f` / `-d`. Outputs `exists` for use in step `if` gates.',
  params: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'Path to check. Relative paths resolve against the project directory.',
    },
    {
      name: 'kind',
      type: 'string',
      required: false,
      default: 'any',
      description: 'What to check for: `any` (mirrors `test -e`, default), `file` (`-f`), or `dir` (`-d`).',
    },
  ],
  outputs: [
    {
      name: 'exists',
      type: 'boolean',
      description: 'True if the path exists and matches `kind`; otherwise false.',
    },
  ],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const target = resolve(flow.projectDir, params['path'] as string);
    const kind = params['kind'] as string;
    if (!['any', 'file', 'dir'].includes(kind)) {
      throw new ExpectedError(`Invalid kind "${kind}". Use one of: any, file, dir.`);
    }

    const exists = pathExists(target, kind as 'any' | 'file' | 'dir');
    flow.log(`${target} ${exists ? 'exists' : 'does not exist'} (kind: ${kind})`);
    output.set('exists', exists);
  },
} satisfies TaskDefinition;
