import { resolve, dirname, join } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { createFlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowRegistry } from '@plugin-ship/core/flow.registry.js';
import { parseCliParams } from '@plugin-ship/core/task.param.js';
import { asError, ExpectedError } from '@plugin-ship/core/util.error.js';
import { runFlow } from '@plugin-ship/core/flow.runner.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';

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
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
    param: Flags.string({ summary: messages.getMessage('flags.param.summary'), multiple: true }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FlowRun);

    const config = loadConfig(flags.config);
    const projectDir = resolve(dirname(flags.config));
    const shipDir = join(projectDir, config.dir);

    const registry = new FlowRegistry(shipDir);
    let flow;
    try {
      flow = registry.resolveFlow(args.flowName);
    } catch (err) {
      this.error(asError(err).message, { exit: 1 });
    }

    let params;
    try {
      params = parseCliParams(flags.param ?? []);
    } catch (err) {
      this.error(asError(err).message, { exit: 1 });
    }

    const context = createFlowContext({
      projectDir,
      shipDir,
      config,
      orgs: new OrgRegistry(resolve(shipDir, 'orgs'), config.project.name),
      // The renderer takes over this logger; this base is only a fallback.
      log: (message: string) => this.log(message),
      params,
      // Subcommands print their own output natively; we only normalise a
      // failure into an ExpectedError so the flow reports it without a stack.
      runCommand: async (id: string, argv: string[]) => {
        try {
          return await this.config.runCommand(id, argv);
        } catch (err) {
          throw new ExpectedError(asError(err).message);
        }
      },
    });

    try {
      await runFlow(args.flowName, flow, context);
    } catch (err) {
      if (!(err instanceof ExpectedError)) throw err;
      process.exit(1);
    }
  }
}
