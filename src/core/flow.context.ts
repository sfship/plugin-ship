import { ShipConfig } from '@plugin-ship/core/config.ship.schema.js';
import { Params } from '@plugin-ship/core/task.param.schema.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';

/**
 * The runtime context passed to every task in a flow run.
 * Provides access to shared infrastructure — config, orgs, and logging —
 * as well as the params the flow was invoked with.
 */
export type FlowContext = {
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
};

/**
 * Creates a {@link FlowContext} with `hasFailures` initialised to `false`.
 *
 * @param init - All context fields except `hasFailures`.
 * @returns A fully initialised {@link FlowContext}.
 */
export function createFlowContext(init: Omit<FlowContext, 'hasFailures'>): FlowContext {
  return { hasFailures: false, ...init };
}
