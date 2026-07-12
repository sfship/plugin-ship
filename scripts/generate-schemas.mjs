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
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ShipConfigSchema } from '../lib/core/config.ship.schema.js';
import { FlowDefinitionSchema } from '../lib/core/flow.definition.schema.js';

const outDir = new URL('../lib/schemas/', import.meta.url);
mkdirSync(outDir, { recursive: true });

function write(name, title, schema) {
  // io: 'input' emits the author-facing shape (pre-transform, defaults optional).
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
  writeFileSync(new URL(`${name}.schema.json`, outDir), JSON.stringify({ ...json, title }, null, 2) + '\n');
}

write('ship', 'ship.yml', ShipConfigSchema);
write('flow', 'plugin-ship flow definition', FlowDefinitionSchema);
