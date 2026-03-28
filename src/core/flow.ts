import { Store } from '@plugin-ship/core/store.js';
import { ShipConfig } from '@plugin-ship/core/config.js';
import { Params } from '@plugin-ship/core/param.js';
import { OrgRegistry } from '@plugin-ship/core/org.registry.js';

/**
 * The runtime context passed to every task in a flow run.
 * Provides access to shared infrastructure — config, state, orgs, and logging —
 * as well as the params the flow was invoked with.
 */
export type FlowContext = {
  /** Absolute path to the `.ship` directory for the current project. */
  shipDir: string;
  /** The loaded ship configuration for this project. */
  config: ShipConfig;
  /** Shared key/value store for passing data between tasks. */
  store: Store;
  /** Registry for accessing Salesforce orgs and their definitions. */
  orgs: OrgRegistry;
  /** Writes a log message to the flow's output. */
  log: (message: string) => void;
  /** The params the flow was invoked with. */
  params: Params;
};
