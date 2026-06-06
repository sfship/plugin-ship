import type { TaskContext, TaskDefinition } from '../../task.js';

/**
 * Sets environment variables for the remainder of the current flow run.
 *
 * Because sf commands run in-process (oclif `runCommand`), variables set here are
 * visible to every subsequent passthrough task in the same run — notably the
 * native `replacements` string substitution that `sf project deploy start` and
 * `sf package version create` apply via `replaceWithEnv`. See the Salesforce CLI
 * "Replace Strings in Code Before Deploying or Packaging" docs.
 *
 * Variables are set on `process.env` only. They live and die with this process —
 * nothing is written to disk, the parent shell, or other projects.
 */
export default {
  description: 'Sets environment variables for the current flow run (in-process only; never persisted).',
  params: [
    {
      name: 'vars',
      type: 'record',
      required: true,
      description:
        'Variables to set, as key=value pairs (e.g. --param vars.SHIP_NAMESPACE=acme__). ' +
        'Read by downstream passthroughs such as `project deploy start` string replacements.',
    },
  ],
  // eslint-disable-next-line @typescript-eslint/require-await
  async run({ flow, params }: TaskContext): Promise<void> {
    const vars = params['vars'] as Record<string, string>;
    const names = Object.keys(vars);
    for (const name of names) {
      process.env[name] = vars[name];
    }
    // Log names only — values may be secrets (a primary use case for replaceWithEnv).
    flow.log(names.length ? `Set ${names.length} env var(s): ${names.join(', ')}` : 'No env vars to set.');
  },
} satisfies TaskDefinition;
