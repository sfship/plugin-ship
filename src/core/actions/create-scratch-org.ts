import { readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { scratchOrgCreate, Org, ConfigAggregator, OrgConfigProperties } from '@salesforce/core';
import { defineAction } from '../define-action.js';
import { getShipDir, resolveOrgAlias } from '../utils.js';

export default defineAction(async ({ cwd, config, params, log, set }) => {
  const shipDir = getShipDir(cwd, config);
  const scratchDef = String(params['scratch-def'] ?? '');
  if (!scratchDef) throw new Error('create-scratch-org requires a `scratch-def` param');

  const definitionPath = scratchDef.endsWith('.json')
    ? resolve(process.cwd(), scratchDef)
    : resolve(shipDir, 'orgs', `${scratchDef}.json`);

  const orgConfig = JSON.parse(readFileSync(definitionPath, 'utf8')) as Record<string, unknown>;

  const defName = basename(definitionPath, extname(definitionPath));
  const alias = String(params['alias'] ?? resolveOrgAlias(defName, shipDir, config.project?.name));
  const duration = params['duration'] ? Number(params['duration']) : 1;

  try {
    const existingOrg = await Org.create({ aliasOrUsername: alias });
    log(`Scratch org ${alias} already exists, skipping.`);
    set('targetOrg', existingOrg.getUsername() ?? alias);
    return;
  } catch (err) {
    if (err instanceof Error && err.name !== 'NamedOrgNotFoundError') throw err;
    // org doesn't exist, proceed with creation
  }

  let hubOrg: Org;
  if (params['dev-hub']) {
    hubOrg = await Org.create({ aliasOrUsername: String(params['dev-hub']) });
  } else {
    const configAggregator = await ConfigAggregator.create();
    const devHub = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB);
    if (!devHub)
      throw new Error('No dev hub found. Pass `dev-hub` param or set a default with `sf config set target-dev-hub`.');
    hubOrg = await Org.create({ aliasOrUsername: String(devHub) });
  }

  const result = await scratchOrgCreate({
    hubOrg,
    orgConfig,
    alias,
    setDefault: Boolean(params['setDefault'] ?? true),
    durationDays: duration,
  });

  for (const warning of result.warnings) log(warning);
  log(`Created scratch org: ${result.username ?? alias}`);
  set('targetOrg', result.username ?? alias);
});
