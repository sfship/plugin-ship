import esmock from 'esmock';

const load = esmock as (path: string, mocks?: Record<string, unknown>) => Promise<Record<string, unknown>>;

export type MockedCommand = { run(argv: string[]): Promise<void> };

/**
 * Esmocks a command module and returns its default export.
 *
 * - commandPath: relative to src/commands/ (e.g. 'ship/task/info.js')
 * - mocks: keys are npm package names (e.g. '@salesforce/core'), src/core/ module names (e.g. 'config.loader.js'), or bare node: specifiers.
 */
export async function mockCommand(
  commandPath: string,
  mocks: Record<string, Record<string, unknown>> = {}
): Promise<MockedCommand> {
  const resolvedMocks: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mocks)) {
    resolvedMocks[key.startsWith('node:') || key.includes('/') ? key : `../../src/core/${key}`] = value;
  }
  const mod = await load(`../../src/commands/${commandPath}`, resolvedMocks);
  return mod['default'] as MockedCommand;
}
