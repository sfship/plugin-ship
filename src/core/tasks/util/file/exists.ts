import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../../task.js';
import { ExpectedError } from '../../../util.error.js';

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

    let exists: boolean;
    if (kind === 'any') {
      exists = existsSync(target);
    } else {
      try {
        const stat = statSync(target);
        exists = kind === 'file' ? stat.isFile() : stat.isDirectory();
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') exists = false;
        else throw err;
      }
    }

    flow.log(`${target} ${exists ? 'exists' : 'does not exist'} (kind: ${kind})`);
    output.set('exists', exists);
  },
} satisfies TaskDefinition;
