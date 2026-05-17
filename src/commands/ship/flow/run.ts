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
import { FlowState } from '@plugin-ship/core/flow.state.js';
import { FlowRenderer } from '@plugin-ship/core/flow.renderer.js';

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

    const steps = Object.entries(flow.steps);
    const finallySteps = Object.entries(flow.finally ?? {});
    const state = new FlowState(args.flowName, steps, finallySteps);
    const renderer = new FlowRenderer();

    const context = createFlowContext({
      projectDir,
      shipDir,
      config,
      orgs: new OrgRegistry(resolve(shipDir, 'orgs'), config.project.name),
      log: (message: string) => renderer.log(message, state.current),
      params,
      runCommand: renderer.wrapCommand((id: string, argv: string[]) => this.config.runCommand(id, argv)),
    });

    process.once('uncaughtException', (err: unknown) => {
      const e = asError(err);
      if ((e as { code?: unknown }).code === 'EEXIT') {
        const exitCode = (e as { oclif?: { exit?: number } }).oclif?.exit ?? 1;
        if (exitCode === 130) {
          (process.stdout as { write: unknown }).write = (): boolean => true;
          (process.stderr as { write: unknown }).write = (): boolean => true;
          const interruptedStep = state.current;
          if (interruptedStep) {
            state.stepFailed(interruptedStep);
            renderer.update(state.getFrame());
          }
          renderer.flowFailed(args.flowName, interruptedStep ?? '?', new ExpectedError('Interrupted by user.'));
        }
        process.exit(exitCode);
      } else {
        renderer.flowFailed(args.flowName, state.current ?? '?', e);
        process.exit(1);
      }
    });

    renderer.update(state.getFrame());

    try {
      await runFlow(args.flowName, flow, context, state, renderer);
    } catch (err) {
      if (!(err instanceof ExpectedError)) throw err;
      process.exit(1);
    }
  }
}
