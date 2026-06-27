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
import { join } from 'node:path';
import { readJson, writeJson } from './file.js';

/** A single `packageDirectories` entry. Only the fields ship reads or writes are typed. */
export type PackageDirectory = {
  [key: string]: unknown;
  path: string;
  package?: string;
  default?: boolean;
  dependencies?: Array<{ package: string; versionNumber?: string }>;
};

/** The parsed shape of `sfdx-project.json`. Unmodeled fields are preserved on write. */
export type SfdxProject = {
  [key: string]: unknown;
  packageDirectories: PackageDirectory[];
  packageAliases?: Record<string, string>;
};

const FILE = 'sfdx-project.json';

/** Reads and parses `sfdx-project.json` from the project directory. */
export function readSfdxProject(projectDir: string): SfdxProject {
  return readJson<SfdxProject>(join(projectDir, FILE));
}

/** Writes `sfdx-project.json` back, preserving 2-space indentation and a trailing newline. */
export function writeSfdxProject(projectDir: string, project: SfdxProject): void {
  writeJson(join(projectDir, FILE), project);
}

/** Returns the default packageDirectory (the one flagged `default`, else the first), or undefined if none exist. */
export function defaultPackageDirectory(project: SfdxProject): PackageDirectory | undefined {
  return project.packageDirectories?.find((d) => d.default) ?? project.packageDirectories?.[0];
}

/** Reads sfdx-project.json and returns the package alias of the default packageDirectory. Returns null on any error. */
export function defaultPackageAlias(projectDir: string): string | null {
  try {
    const project = readSfdxProject(projectDir);
    return defaultPackageDirectory(project)?.package ?? null;
  } catch {
    return null;
  }
}
