import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { TaskContext, TaskDefinition } from '@plugin-ship/core/task.js';

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : Promise.resolve([fullPath]);
    })
  );
  return nested.flat();
}

async function replaceTokens(filePath: string, tokens: Record<string, string>): Promise<void> {
  const buf = await readFile(filePath);
  if (buf.includes(0)) return; // skip binary files
  let content = buf.toString('utf8');
  for (const [token, replacement] of Object.entries(tokens)) {
    content = content.replaceAll(`%%%${token}%%%`, replacement);
  }
  await writeFile(filePath, content, 'utf8');
}

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
      required: true,
      description: 'Destination directory for the prepared source.',
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
      name: 'outputDir',
      type: 'string',
      description: 'Absolute path to the prepared source directory.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const sourceDir = resolve(process.cwd(), (params['source-dir'] as string | undefined) ?? 'force-app');
    const outputDir = resolve(process.cwd(), params['output-dir'] as string);
    const tokens = (params['tokens'] ?? {}) as Record<string, string>;

    flow.log(`Copying ${sourceDir} → ${outputDir}`);
    await cp(sourceDir, outputDir, { recursive: true, force: true });

    const files = await walkFiles(outputDir);

    if (Object.keys(tokens).length > 0) {
      await Promise.all(files.map((file) => replaceTokens(file, tokens)));
    }

    flow.log(`Prepared ${files.length} files`);
    output.set('outputDir', outputDir);
  },
} satisfies TaskDefinition;
