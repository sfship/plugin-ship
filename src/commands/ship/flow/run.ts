import { spawn } from 'node:child_process';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '../../../core/config.js';
import { runFlow } from '../../../core/flow-runner.js';
import { requireValue } from '../../../core/utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-ship', 'ship.flow.run');

/** Executes a named flow defined in `ship.yml`. */
export default class FlowRun extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    flowName: Args.string({ description: messages.getMessage('flags.name.summary'), required: true }),
  };

  public static readonly flags = {
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public static readonly enableJsonFlag = false;

  /** Loads the config and runs the specified flow. */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FlowRun);
    const noOrgMessage = 'No target org provided. Use --target-org to specify one.';
    const org = requireValue(flags['target-org'], noOrgMessage);
    const connection = requireValue(flags['target-org']?.getConnection(flags['api-version']), noOrgMessage);
    const cwd = process.cwd();
    const config = loadConfig(cwd);

    await runFlow(
      args.flowName,
      config,
      {
        org,
        connection,
        query: async (soql) => {
          const result = await connection.query(soql);
          return result.records as Array<Record<string, unknown>>;
        },
        runSf: (argv) =>
          new Promise((resolve, reject) => {
            const cli = config.cli ?? 'sf';
            const [executable, spawnArgs] =
              process.platform === 'win32' ? ['cmd.exe', ['/c', cli, ...argv]] : [cli, argv];
            const child = spawn(executable, spawnArgs, {
              stdio: 'inherit',
              env: { ...process.env, NODE_NO_WARNINGS: '1' },
              cwd,
            });
            child.on('close', (code) =>
              code === 0 ? resolve() : reject(new Error(`${cli} ${argv.join(' ')} exited with code ${String(code)}`))
            );
            child.on('error', reject);
          }),
        log: (message) => this.log(message),
      },
      cwd
    );
  }
}
