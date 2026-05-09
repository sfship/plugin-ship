import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';
import { walkFiles, replaceTokens, buildTokenMap } from '@plugin-ship/core/util.token.js';

export default {
  description: 'Copies source to a temporary directory and replaces %%%TOKEN%%% placeholders.',
  params: [
    {
      name: 'source-dir',
      type: 'string',
      required: false,
      description: 'Source directory to copy. Defaults to "force-app".',
    },
    {
      name: 'output-dir',
      type: 'string',
      required: false,
      default: '.ship/tmp',
      description: 'Destination directory for the prepared source. Defaults to ".ship/tmp".',
    },
    {
      name: 'tokens',
      type: 'record',
      required: false,
      description: 'Token replacement map. Keys are token names (without %%% delimiters), values are replacements.',
    },
  ],
  outputs: [
    {
      name: 'output-dir',
      type: 'string',
      description: 'Absolute path to the prepared source directory.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const sourceDir = resolve(process.cwd(), (params['source-dir'] as string | undefined) ?? 'force-app');
    const outputDir = resolve(process.cwd(), (params['output-dir'] as string | undefined) ?? '.ship/tmp');
    const ns = flow.config.project.package?.namespace ?? '';
    const tokens = {
      ...buildTokenMap(ns),
      ...((params['tokens'] as Record<string, string> | undefined) ?? {}),
    };

    flow.log(`Copying ${sourceDir} → ${outputDir}`);
    await cp(sourceDir, outputDir, { recursive: true, force: true });

    const files = await walkFiles(outputDir);
    await Promise.all(files.map((file) => replaceTokens(file, tokens)));

    flow.log(`Prepared ${files.length} files`);
    output.set('output-dir', outputDir);
  },
} satisfies TaskDefinition;
