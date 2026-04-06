import { resolve } from 'node:path';
import { Org } from '@salesforce/core';
import { ScratchOrgDef, ScratchOrgDefSchema } from '@plugin-ship/core/scratch-org.js';
import { fileExists, readText } from '@plugin-ship/core/file.js';
import { ExpectedError } from './error.utils.js';

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
   * Resolves a raw alias to a qualified alias using the project naming convention.
   * If a matching scratch org definition exists in the orgs directory,
   * returns `<projectName>:<alias>`. Otherwise returns the alias as-is.
   *
   * @param alias - The raw alias, e.g. `"dev"`.
   * @returns The qualified alias, e.g. `"myproject:dev"`, or the original alias if no def file exists.
   */
  public resolveAlias(alias: string): string {
    const defPath = resolve(this.orgsDir, `${alias}.json`);
    if (!fileExists(defPath))
      throw new ExpectedError(`No scratch org definition found for alias "${alias}" at ${defPath}`);
    if (this.projectName) return `${this.projectName}:${alias}`;
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
