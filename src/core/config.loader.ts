/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { dirname, join, resolve } from 'node:path';
import type { ZodError } from 'zod';
import { parse } from 'yaml';
import { ShipConfig, ShipConfigSchema } from './config.ship.schema.js';
import { readText } from './file.js';
import { ExpectedError, formatZodError } from './error.js';

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
    throw new ExpectedError(`Could not parse ship.yml: ${(err as Error).message}`);
  }

  try {
    return ShipConfigSchema.parse(parsed);
  } catch (err) {
    throw new ExpectedError(`Invalid ship.yml:\n${formatZodError(err as ZodError)}`);
  }
}

/**
 * Resolves a project's directory layout from the path to its `ship.yml`.
 *
 * `projectDir` is the directory containing the config file; `shipDir` is
 * `config.dir` resolved relative to it. Every command goes through this so
 * `.ship` is located the same way regardless of the process's working directory.
 *
 * @param configPath - The `--config` path to the `ship.yml` file.
 * @param config - The loaded config, for its `dir` setting.
 */
export function resolveProjectPaths(configPath: string, config: ShipConfig): { projectDir: string; shipDir: string } {
  const projectDir = resolve(dirname(configPath));
  return { projectDir, shipDir: join(projectDir, config.dir) };
}
