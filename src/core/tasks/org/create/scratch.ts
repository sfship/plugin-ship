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
import { readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { scratchOrgCreate, Org, ConfigAggregator, OrgConfigProperties } from '@salesforce/core';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { ExpectedError } from '../../../error.js';

export default {
  description: 'Creates a scratch org, or skips if a healthy one already exists under the same alias.',
  outputs: [
    { name: 'target-org', type: 'string', description: 'The alias of the created (or existing) scratch org.' },
    {
      name: 'created',
      type: 'boolean',
      description: 'True if a new scratch org was created; false if a healthy existing one was reused.',
    },
  ],
  params: [
    {
      name: 'scratch-def',
      type: 'string',
      required: true,
      description: 'Scratch org def alias (looked up in <shipDir>/orgs/) or path to a .json def file.',
    },
    {
      name: 'alias',
      type: 'string',
      required: false,
      description: 'Override the org alias. Defaults to the def name prefixed by the project name.',
    },
    { name: 'duration', type: 'number', required: false, description: 'Duration in days. Defaults to 1.' },
    {
      name: 'dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'set-default',
      type: 'boolean',
      required: false,
      description: 'Set as default org after creation. Defaults to true.',
    },
    {
      name: 'no-namespace',
      type: 'boolean',
      required: false,
      description:
        'Create the scratch without the project namespace. Defaults to false (inherits the sfdx-project.json namespace). Set true for orgs that install a managed package of the same namespace, e.g. feature or beta CI orgs.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const scratchDef = params['scratch-def'] as string;

    const definitionPath = scratchDef.endsWith('.json')
      ? resolve(process.cwd(), scratchDef)
      : resolve(flow.shipDir, 'orgs', `${scratchDef}.json`);

    const orgConfig = JSON.parse(readFileSync(definitionPath, 'utf8')) as Record<string, unknown>;
    const defName = basename(definitionPath, extname(definitionPath));
    const alias = (params['alias'] as string | undefined) ?? flow.orgs.resolveAlias(defName);
    const duration = (params['duration'] as number | undefined) ?? 1;

    let hubOrg: Org;
    if (params['dev-hub']) {
      hubOrg = await Org.create({ aliasOrUsername: params['dev-hub'] as string });
    } else {
      const configAggregator = await ConfigAggregator.create();
      const devHub = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB);
      if (!devHub)
        throw new ExpectedError(
          'No dev hub found. Pass `dev-hub` param or set a default with `sf config set target-dev-hub`.'
        );
      hubOrg = await Org.create({ aliasOrUsername: String(devHub) });
    }

    try {
      const existingOrg = await Org.create({ aliasOrUsername: alias });
      try {
        await existingOrg.checkScratchOrg(hubOrg.getUsername());
        flow.log(`Scratch org ${alias} already exists, skipping.`);
        output.set('target-org', alias);
        output.set('created', false);
        return;
      } catch (healthErr) {
        if (healthErr instanceof Error && healthErr.name === 'NoResultsError') {
          flow.log(`Scratch org ${alias} is expired, removing and recreating.`);
          await existingOrg.remove();
        } else {
          throw healthErr;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'NamedOrgNotFoundError') throw err;
    }

    // The library's auto-lookup via SfProjectJson.create({}) doesn't reliably
    // resolve sfdx-project.json from our in-process invocation context, but it
    // reads orgConfig.namespace before falling back to auto-lookup — so inject it.
    const wantNoNamespace = params['no-namespace'] === true;
    const namespace = flow.config.project.package?.namespace;
    if (namespace && !wantNoNamespace) {
      orgConfig.namespace = namespace;
    }

    const result = await scratchOrgCreate({
      hubOrg,
      orgConfig,
      alias,
      setDefault: (params['set-default'] as boolean | undefined) ?? true,
      durationDays: duration,
      nonamespace: wantNoNamespace,
    });

    for (const warning of result.warnings) flow.log(warning);
    flow.log(`Created scratch org: ${result.username ?? alias}`);
    output.set('target-org', alias);
    output.set('created', true);
  },
} satisfies TaskDefinition;
