import { Task } from '@plugin-ship/core/task.js';
import utilLog from '@plugin-ship/core/tasks/util/log.js';
import storeSet from '@plugin-ship/core/tasks/store/set.js';
import orgScratchCreate from '@plugin-ship/core/tasks/org/scratch/create.js';
import orgScratchDelete from '@plugin-ship/core/tasks/org/scratch/delete.js';
import metadataDeploy from '@plugin-ship/core/tasks/metadata/deploy.js';
import githubRepoInfo from '@plugin-ship/core/tasks/github/repo/info.js';
import apexTestRun from '@plugin-ship/core/tasks/apex/test/run.js';

const tasks: Record<string, Task> = {
  'util/log': utilLog,
  'store/set': storeSet,
  'org/scratch/create': orgScratchCreate,
  'org/scratch/delete': orgScratchDelete,
  'metadata/deploy': metadataDeploy,
  'github/repo/info': githubRepoInfo,
  'apex/test/run': apexTestRun,
};

export default tasks;
