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
import { Args } from '@oclif/core';
import { SfCommand, Flags, Ux, StandardColors } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { loadConfig, resolveProjectPaths } from '../../../core/config.loader.js';
import { FlowRegistry } from '../../../core/flow.registry.js';
import { asError } from '../../../core/error.js';
import { formatFlowPreview } from '../../../core/flow.view.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@sfship/plugin-ship', 'ship.flow.info');

/** Shows description, params, and steps for a flow. */
export default class FlowInfo extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    flowName: Args.string({ description: messages.getMessage('args.flowName.summary'), required: true }),
  };

  public static readonly flags = {
    config: Flags.file({ default: 'ship.yml', summary: messages.getMessage('flags.config.summary') }),
  };

  public static readonly enableJsonFlag = false;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FlowInfo);

    this.log('');
    this.styledHeader('Flow Info');

    const config = loadConfig(flags.config);
    const { shipDir } = resolveProjectPaths(flags.config, config);
    const registry = new FlowRegistry(shipDir);
    let flow;
    try {
      flow = registry.resolveFlow(args.flowName);
    } catch (err) {
      this.error(asError(err).message, { exit: 1 });
    }

    const ux = new Ux();
    this.log(formatFlowPreview(args.flowName, flow.description));
    this.log('');

    if (flow.params && flow.params.length > 0) {
      this.styledHeader('Params');
      ux.table({
        data: flow.params.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required ? 'yes' : 'no',
          default: p.default ?? '—',
          description: p.description ?? '—',
        })),
      });
    }

    this.styledHeader('Flow Steps');
    ux.table({
      data: Object.entries(flow.steps).map(([stepId, step], index) => ({
        '#': index + 1,
        id: stepId,
        task: step.task,
        params: step.params
          ? Object.entries(step.params)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join(', ')
          : '—',
      })),
    });

    const requiredParams = (flow.params ?? [])
      .filter((p) => p.required)
      .map((p) => `--param ${p.name}=<${p.name}>`)
      .join(' ');
    const exampleCmd = [`sf ship flow run ${args.flowName}`, requiredParams].filter(Boolean).join(' ');
    this.log(StandardColors.info('Tip:') + ' Run ' + StandardColors.success(exampleCmd) + ' to execute this flow.');
    this.log('');
  }
}
