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
import { StandardColors } from '@salesforce/sf-plugins-core';
import type { TaskContext, TaskDefinition } from '../../../task.definition.schema.js';
import { resolveDependencies, computeDrift, type PackageIdStep } from '../../../package.dependencies.js';
import { readSfdxProject } from '../../../sfdx-project.js';
import { ExpectedError } from '../../../error.js';

export default {
  description:
    'Verifies that the dependencies declared in ship.yml match what is committed in sfdx-project.json, failing if they have drifted. Guards a release build against stale or unsynced dependencies.',
  async run({ flow }: TaskContext): Promise<void> {
    const deps = flow.config.project.package?.dependencies ?? [];
    const steps = (await resolveDependencies(deps)).filter((s): s is PackageIdStep => s.kind === 'package-id');
    const { missing, stale, names } = computeDrift(steps, readSfdxProject(flow.projectDir));

    if (missing.length || stale.length) {
      const label = (id: string): string => {
        const name = names.get(id);
        return name ? `${name} (${id})` : id;
      };
      const width = Math.max(...[...missing, ...stale].map((id) => label(id).length));
      throw new ExpectedError(
        [
          StandardColors.error('Dependencies are out of sync.'),
          `${StandardColors.info('ship.yml')} resolves to a different set than ${StandardColors.info(
            'sfdx-project.json'
          )} declares:`,
          '',
          ...missing.map(
            (id) =>
              `    ${StandardColors.success('+')} ${label(id).padEnd(
                width
              )}  in ship.yml, missing from sfdx-project.json`
          ),
          ...stale.map(
            (id) =>
              `    ${StandardColors.error('-')} ${label(id).padEnd(width)}  in sfdx-project.json, dropped from ship.yml`
          ),
          '',
          `${StandardColors.info('→ To fix, run this and commit the change:')}`,
          `    ${StandardColors.success('sf ship flow run dependencies/lock')}`,
        ].join('\n')
      );
    }

    flow.log(`Dependencies in sync (${steps.length} package${steps.length === 1 ? '' : 's'}).`);
  },
} satisfies TaskDefinition;
