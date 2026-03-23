import { ActionDefinition } from '../types.js';
import utilLog from './util/log.js';
import orgScratchCreate from './org/scratch/create.js';
import orgScratchDelete from './org/scratch/delete.js';
import metadataDeploy from './metadata/deploy.js';
import githubRepoInfo from './github/repo/info.js';

const actions: Record<string, ActionDefinition> = {
  'util:log': utilLog,
  'org:scratch:create': orgScratchCreate,
  'org:scratch:delete': orgScratchDelete,
  'metadata:deploy': metadataDeploy,
  'github:repo:info': githubRepoInfo,
};

export default actions;
