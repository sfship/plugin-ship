import { Org } from '@salesforce/core';
import { defineAction } from '../define-action.js';
import { getShipDir, resolveOrgAlias } from '../utils.js';

export default defineAction(async ({ cwd, config, params, log }) => {
  const raw = String(params['alias'] ?? '');
  if (!raw) throw new Error('delete-scratch-org requires an `alias` param');

  const shipDir = getShipDir(cwd, config);
  const alias = resolveOrgAlias(raw, shipDir, config.project?.name);

  const scratchOrg = await Org.create({ aliasOrUsername: alias });
  await scratchOrg.delete();
  log(`Deleted scratch org: ${alias}`);
});
