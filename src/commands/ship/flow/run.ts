import { resolve } from 'node:path';
import { Args } from '@oclif/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig } from '@plugin-ship/core/config.loader.js';
import { FlowContext } from '@plugin-ship/core/flow.context.js';
import { FlowRegistry } from '@plugin-ship/core/flow.registry.js';
import { parseCliParams } from '@plugin-ship/core/param.js';
import { asError, ExpectedError } from '@plugin-ship/core/error.utils.js';
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

  /**
   * Loads the ship.yml config, resolves the named flow, builds the flow context,
   * and delegates execution to the flow runner.
   *
   * @throws If the config file cannot be read, is invalid, or the named flow is not defined.
   */
  public async run(): Promise<void> {
    // Parse CLI args and flags from the command invocation
    const { args, flags } = await this.parse(FlowRun);

    // Load and parse the ship.yml config file from the specified path
    const config = loadConfig(flags.config);

    // Get path for .ship directory
    const shipDir = resolve(config.dir);

    // Look up the named flow — error early if it doesn't exist
    const registry = new FlowRegistry(shipDir, config.flows);
    let flow;
    try {
      flow = registry.resolveFlow(args.flowName);
    } catch (err) {
      this.error(asError(err).message, { exit: 1 });
    }

    // Parse --param flags — invalid format (missing =) is a CLI-layer error
    let params;
    try {
      params = parseCliParams(flags.param ?? []);
    } catch (err) {
      this.error(asError(err).message, { exit: 1 });
    }

    // Build the flow context passed to every step in the flow
    const context: FlowContext = {
      shipDir,
      config,
      orgs: new OrgRegistry(resolve(shipDir, 'orgs'), config.project.name),
      log: (message: string) => this.log(message),
      params,
    };

    // Hand off to the runner which resolves and executes each step in order.
    // Errors are formatted and printed by the runner; catch here to suppress oclif's default error output.
    try {
      await runFlow(args.flowName, flow, context);
    } catch (err) {
      if (!(err instanceof ExpectedError)) throw err;
      process.exit(1);
    }
  }
}
