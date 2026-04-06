import { parse } from 'yaml';
import { ShipConfig, ShipConfigSchema } from '@plugin-ship/core/config.js';
import { readText } from '@plugin-ship/core/file.js';

/**
 * Reads and parses a `ship.yml` config file, validating it against {@link ShipConfigSchema}.
 *
 * @param configPath - Path to the config file. Defaults to `'ship.yml'` in the current directory.
 * @returns The validated {@link ShipConfig}.
 * @throws If the file cannot be read or fails schema validation.
 */
export function loadConfig(configPath: string = 'ship.yml'): ShipConfig {
  let raw: string;
  try {
    raw = readText(configPath);
  } catch {
    throw new Error(`No ship.yml found at ${configPath}`);
  }

  const parsed = parse(raw) as unknown;

  try {
    return ShipConfigSchema.parse(parsed);
  } catch (err) {
    throw new Error(`Invalid ship.yml: ${(err as Error).message}`);
  }
}
