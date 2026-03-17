import { ActionDefinition } from '../types.js';
import logAction from './log.js';
import createScratchOrgAction from './create-scratch-org.js';
import deleteScratchOrgAction from './delete-scratch-org.js';
import deployMetadataAction from './deploy-metadata.js';

const actions: Record<string, ActionDefinition> = {
  log: logAction,
  'create-scratch-org': createScratchOrgAction,
  'delete-scratch-org': deleteScratchOrgAction,
  'deploy-metadata': deployMetadataAction,
};

export default actions;
