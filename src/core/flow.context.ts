import { ShipConfig } from '@plugin-ship/core/config.ship.schema.js';
import { Params } from '@plugin-ship/core/task.param.schema.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';

export type FlowContext = {
  /** Absolute path to the directory containing `ship.yml` — the project root. */
  projectDir: string;
  /** Absolute path to the `.ship` directory for the current project. */
  shipDir: string;
  /** The loaded ship configuration for this project. */
  config: ShipConfig;
  /** Registry for accessing Salesforce orgs and their definitions. */
  orgs: OrgRegistry;
  /** Writes a log message to the flow's output. */
  log: (message: string) => void;
  /** The params the flow was invoked with. */
  params: Params;
  /** True if any step has failed with ignore-failure during this flow run. */
  hasFailures: boolean;
  /** Invokes an sf CLI command in-process via oclif's plugin system. */
  runCommand: (id: string, argv: string[]) => Promise<unknown>;
};

export function createFlowContext(init: Omit<FlowContext, 'hasFailures'>): FlowContext {
  return { hasFailures: false, ...init };
}
