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

/* c8 ignore start */
import { z } from 'zod';
import { ShipDependencySchema, ShipDependency } from './config.dependency.schema.js';

/** Salesforce packaging metadata for the project. */
const ProjectPackageConfigSchema = z
  .object({
    name: z.string().describe('The package name as it appears in the Salesforce packaging UI.'),
    namespace: z.string().optional().describe('The package namespace.'),
    type: z.enum(['Managed', 'Unlocked']).describe('The package type.'),
    permsets: z
      .array(z.string())
      .optional()
      .describe(
        'Permission sets (and/or permission set groups) to assign to the running user after package install in flow contexts.'
      ),
    testPattern: z
      .string()
      .default('*_Test')
      .describe('Glob pattern used to discover Apex test classes. Defaults to "*_Test".'),
    dependencies: z
      .array(ShipDependencySchema)
      .optional()
      .describe('Packages to install before deploying or packaging.'),
  })
  .strict();

/** Git/GitHub configuration for the project. */
const ProjectGitConfigSchema = z.object({
  defaultBranch: z.string().optional().describe('The main branch name. Defaults to `main`.'),
  repoUrl: z.url().optional().describe('The GitHub repository URL.'),
});

/** Top-level project metadata within a ship config. */
const ProjectConfigSchema = z
  .object({
    slug: z
      .string()
      .optional()
      .describe(
        'URL/alias-safe slug used as a prefix for generated org aliases. Defaults to package.name lowercased with spaces replaced by hyphens.'
      ),
    package: ProjectPackageConfigSchema.optional().describe('Optional Salesforce package metadata.'),
    git: ProjectGitConfigSchema.optional().describe('Optional Git repository configuration.'),
  })
  .strict()
  .transform((data) => ({
    ...data,
    slug: data.slug ?? data.package?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'project',
  }));

/**
 * Zod schema for the top-level `ship.yml`.
 * Defines the project and optional ship directory override.
 */
export const ShipConfigSchema = z
  .object({
    project: ProjectConfigSchema.describe('Project metadata.'),
    dir: z
      .string()
      .default('.ship')
      .describe(
        'Directory used to resolve custom tasks, scratch-org defs, and other ship assets. Defaults to `.ship`.'
      ),
  })
  .strict();

export type { ShipDependency };
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectPackageConfig = z.infer<typeof ProjectPackageConfigSchema>;
export type ProjectGitConfig = z.infer<typeof ProjectGitConfigSchema>;
/** The validated top-level ship configuration, inferred from {@link ShipConfigSchema}. */
export type ShipConfig = z.infer<typeof ShipConfigSchema>;
/* c8 ignore stop */
