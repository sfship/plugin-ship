import { readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { scratchOrgCreate, Org, ConfigAggregator, OrgConfigProperties } from '@salesforce/core';
import { Task, TaskContext, OutputDefinition } from '@plugin-ship/core/task.js';
import { ParamDefinition } from '@plugin-ship/core/param.js';

export default new (class OrgScratchCreate extends Task {
  public readonly name = 'org/scratch/create';
  public readonly description = 'Creates a scratch org, or skips if a healthy one already exists under the same alias.';
  public readonly outputs: OutputDefinition[] = [
    { name: 'targetOrg', type: 'string', description: 'The username of the created (or existing) scratch org.' },
  ];

  public readonly params: ParamDefinition[] = [
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
      name: 'setDefault',
      type: 'boolean',
      required: false,
      description: 'Set as default org after creation. Defaults to true.',
    },
  ];

  // eslint-disable-next-line class-methods-use-this
  public async run({ flow, params }: TaskContext): Promise<void> {
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
        throw new Error('No dev hub found. Pass `dev-hub` param or set a default with `sf config set target-dev-hub`.');
      hubOrg = await Org.create({ aliasOrUsername: String(devHub) });
    }

    try {
      const existingOrg = await Org.create({ aliasOrUsername: alias });
      try {
        await existingOrg.checkScratchOrg(hubOrg.getUsername());
        flow.log(`Scratch org ${alias} already exists, skipping.`);
        flow.store.set('targetOrg', existingOrg.getUsername() ?? alias);
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
      // org doesn't exist, proceed with creation
    }

    const result = await scratchOrgCreate({
      hubOrg,
      orgConfig,
      alias,
      setDefault: (params['setDefault'] as boolean | undefined) ?? true,
      durationDays: duration,
    });

    for (const warning of result.warnings) flow.log(warning);
    flow.log(`Created scratch org: ${result.username ?? alias}`);
    flow.store.set('targetOrg', result.username ?? alias);
  }
})();
