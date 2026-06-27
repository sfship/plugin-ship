/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ShipConfig } from './config.ship.schema.js';
import { Params } from './task.param.schema.js';
import { OrgRegistry } from './org.registry.js';

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
