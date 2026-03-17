import { spawn } from 'node:child_process';
import { Org } from '@salesforce/core';
import { type ActionContext, type ShipConfig } from './types.js';

/**
 * Builds the {@link ActionContext} passed to every action at runtime.
 *
 * @param opts.config - Parsed ship.yml config.
 * @param opts.cwd - Absolute path to the project root (where ship.yml lives).
 * @param opts.log - Function used to emit log messages to the user.
 */
export function buildContext(opts: { config: ShipConfig; cwd: string; log: (message: string) => void }): ActionContext {
  const { config, cwd, log } = opts;
  const vars: Record<string, unknown> = {};
  const orgCache = new Map<string, Org>();

  return {
    getOrg: async (aliasOrUsername): Promise<Org> => {
      if (!orgCache.has(aliasOrUsername)) {
        orgCache.set(aliasOrUsername, await Org.create({ aliasOrUsername }));
      }
      return orgCache.get(aliasOrUsername)!;
    },
    config,
    cwd,
    exec: async (command: string): Promise<void> => {
      const [cmd, ...argv] = command.split(' ').filter(Boolean);
      await new Promise<void>((res, rej) => {
        const [executable, spawnArgs] = process.platform === 'win32' ? ['cmd.exe', ['/c', cmd, ...argv]] : [cmd, argv];
        const child = spawn(executable, spawnArgs, {
          stdio: 'inherit',
          env: { ...process.env, NODE_NO_WARNINGS: '1' },
          cwd,
        });
        child.on('close', (code) =>
          code === 0 ? res() : rej(new Error(`${command} exited with code ${String(code)}`))
        );
        child.on('error', rej);
      });
    },
    log,
    set: (key, value): void => {
      vars[key] = value;
    },
    get: (key): unknown => vars[key],
  };
}
