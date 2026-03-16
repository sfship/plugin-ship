import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type ShipConfig } from './types.js';

/**
 * Loads and parses the `ship.yml` configuration file from the given directory.
 *
 * @param cwd - The directory to search for `ship.yml`. Defaults to `process.cwd()`.
 * @returns The parsed {@link ShipConfig} object.
 * @throws {Error} If no `ship.yml` file is found in `cwd`.
 */
export function loadConfig(cwd: string = process.cwd()): ShipConfig {
  const configPath = join(cwd, 'ship.yml');
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    throw new Error(`No ship.yml found in ${cwd}`);
  }
  return parse(raw) as ShipConfig;
}
