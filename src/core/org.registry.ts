/*
 * Copyright 2026, Salesforce, Inc.
 *
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
import { resolve } from 'node:path';
import { Org } from '@salesforce/core';
import { ScratchOrgDef, ScratchOrgDefSchema } from './org.scratch.schema.js';
import { fileExists, readText } from './file.js';
import { ExpectedError } from './error.js';

/**
 * Manages lazy-loaded Salesforce `Org` instances and scratch org definitions
 * for a flow run. Caches both to avoid redundant filesystem reads and
 * `Org.create()` calls across tasks.
 */
export class OrgRegistry {
  private orgs = new Map<string, Org>();
  private defs = new Map<string, ScratchOrgDef>();

  /**
   * @param orgsDir - Path to the directory containing scratch org definition JSON files.
   * @param projectName - Optional project name used to qualify org aliases (e.g. `"myproject:dev"`).
   */
  public constructor(private readonly orgsDir: string, private readonly projectName?: string) {}

  /**
   * Resolves an org identifier to a qualified alias or username for use with `Org.create()`.
   *
   * Resolution order:
   * 1. If a def file exists in the orgs directory, qualifies as `<projectName>:<alias>`.
   * 2. If the input contains `@`, treats it as a Salesforce username and returns as-is.
   * 3. Otherwise assumes it is an SF CLI alias and returns as-is.
   *
   * @param alias - A project alias, Salesforce username, or SF CLI alias.
   */
  public resolveAlias(alias: string): string;
  public resolveAlias(alias: string | undefined): string | undefined;
  public resolveAlias(alias: string | undefined): string | undefined {
    if (alias === undefined) return undefined;
    const defPath = resolve(this.orgsDir, `${alias}.json`);
    if (fileExists(defPath)) return this.projectName ? `${this.projectName}:${alias}` : alias;
    return alias;
  }

  /**
   * Returns an Org instance for the given alias,
   * creating and caching it if it hasn't been instantiated yet.
   * Automatically qualifies the alias using the project naming convention.
   *
   * @param alias - The raw org alias, e.g. "dev".
   */
  public async getOrg(alias: string): Promise<Org> {
    const qualified = this.resolveAlias(alias);
    if (!this.orgs.has(qualified)) {
      this.orgs.set(qualified, await Org.create({ aliasOrUsername: qualified }));
    }
    return this.orgs.get(qualified)!;
  }

  /**
   * Returns the scratch org definition for the given alias,
   * reading and caching the JSON file if it hasn't been loaded yet.
   *
   * @param alias - The scratch org alias, e.g. "dev".
   */
  public getDef(alias: string): ScratchOrgDef {
    if (!this.defs.has(alias)) {
      const defPath = resolve(this.orgsDir, `${alias}.json`);
      if (!fileExists(defPath)) {
        throw new ExpectedError(`No scratch org definition found for alias "${alias}" at ${defPath}`);
      }
      this.defs.set(alias, ScratchOrgDefSchema.parse(JSON.parse(readText(defPath))));
    }
    return this.defs.get(alias)!;
  }
}
