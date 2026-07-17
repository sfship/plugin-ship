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

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './file.js';

// Note: this must be the plugin's own version; an oclif command's `this.config.version` is the sf CLI's.
const { version } = readJson<{ version: string }>(
  join(fileURLToPath(import.meta.url), '..', '..', '..', 'package.json')
);

// A dist-tag URL serves the schema of the channel's latest release, so scaffolded
// modelines track plugin updates without edits. Prereleases publish under `beta`.
const channel = version.includes('-') ? 'beta' : 'latest';

/**
 * yaml-language-server modeline pointing at the published JSON Schema for this
 * plugin's release channel, so editors validate and autocomplete scaffolded YAML.
 */
export function schemaModeline(schema: 'ship' | 'flow'): string {
  return `# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@sfship/plugin-ship@${channel}/lib/schemas/${schema}.schema.json`;
}
