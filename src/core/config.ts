import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { type ShipConfig } from './types.js';

/**
 * Loads and parses a `ship.yml` configuration file.
 *
 * @param configPath - Path to the `ship.yml` file. Defaults to `ship.yml` in `process.cwd()`.
 * @returns The parsed {@link ShipConfig} object.
 * @throws {Error} If the file cannot be read.
 */
export function loadConfig(configPath: string = 'ship.yml'): ShipConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    throw new Error(`No ship.yml found at ${configPath}`);
  }
  return parse(raw) as ShipConfig;
}
