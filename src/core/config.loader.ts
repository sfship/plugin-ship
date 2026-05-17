import type { ZodError } from 'zod';
import { parse } from 'yaml';
import { ShipConfig, ShipConfigSchema } from './config.ship.schema.js';
import { readText } from './util.file.js';
import { ExpectedError, formatZodError } from './util.error.js';

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
    throw new ExpectedError(`No ship.yml found at ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    throw new ExpectedError(`Invalid flow definition: ${(err as Error).message}`);
  }

  try {
    return ShipConfigSchema.parse(parsed);
  } catch (err) {
    throw new ExpectedError(`Invalid ship.yml:\n${formatZodError(err as ZodError)}`);
  }
}
