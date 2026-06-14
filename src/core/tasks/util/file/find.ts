import { readdirSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';
import type { TaskContext, TaskDefinition } from '../../../task.js';

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function collectFiles(dir: string, regex: RegExp, recursive: boolean, stripExt: boolean): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (recursive) results.push(...collectFiles(join(dir, entry.name), regex, recursive, stripExt));
    } else if (entry.isFile()) {
      const nameNoExt = basename(entry.name, extname(entry.name));
      if (regex.test(nameNoExt)) {
        results.push(stripExt ? nameNoExt : entry.name);
      }
    }
  }
  return results;
}

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
  run({ flow, params, output }: TaskContext): void {
    const dir = resolve(flow.projectDir, params['path'] as string);
    const pattern = (params['pattern'] as string | undefined) ?? '*';
    const recursive = params['recursive'] !== false;
    const stripExt = params['strip-extension'] !== false;

    const files = collectFiles(dir, globToRegex(pattern), recursive, stripExt);

    flow.log(`Found ${files.length} file(s) matching "${pattern}" in ${params['path'] as string}.`);
    output.set('files', files.join(','));
    output.set('count', String(files.length));
  },
} satisfies TaskDefinition;
