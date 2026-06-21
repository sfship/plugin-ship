import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';

let findFilesResult: string[] = [];

const find = await mockTask('util/file/find.js', {
  'file.js': { findFiles: async () => findFilesResult },
});

beforeEach(() => {
  findFilesResult = [];
});

describe('util:file:find', () => {
  it('writes matching file names and count to outputs', async () => {
    findFilesResult = ['deploy', 'build'];
    const { outputs } = await runTask(find, { params: { path: 'src' } });
    assert.equal(outputs['files'], 'deploy,build');
    assert.equal(outputs['count'], '2');
  });

  it('writes empty files and zero count when nothing matches', async () => {
    findFilesResult = [];
    const { outputs } = await runTask(find, { params: { path: 'src' } });
    assert.equal(outputs['files'], '');
    assert.equal(outputs['count'], '0');
  });
});
