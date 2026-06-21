import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';

let pathExistsResult = false;

const exists = await mockTask('util/file/exists.js', {
  'file.js': { pathExists: () => pathExistsResult },
});

beforeEach(() => {
  pathExistsResult = false;
});

describe('util:file:exists', () => {
  it('writes true when the path exists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'any' } });
    assert.equal(outputs['exists'], true);
  });

  it('writes false when the path does not exist', async () => {
    pathExistsResult = false;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'any' } });
    assert.equal(outputs['exists'], false);
  });

  it('passes kind=file through to pathExists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'file' } });
    assert.equal(outputs['exists'], true);
  });

  it('passes kind=dir through to pathExists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'dir' } });
    assert.equal(outputs['exists'], true);
  });

  it('throws ExpectedError for an invalid kind', async () => {
    await assert.rejects(
      () => runTask(exists, { params: { path: 'src', kind: 'symlink' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('Invalid kind')
    );
  });
});
