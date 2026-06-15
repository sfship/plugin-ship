/* c8 ignore start */
import { z } from 'zod';
import { ShipDependencySchema, ShipDependency } from './config.dependency.schema.js';

/** Salesforce packaging metadata for the project. */
const ProjectPackageConfigSchema = z
  .object({
    /** The package name as it appears in the Salesforce packaging UI. */
    name: z.string(),
    /** The package namespace. */
    namespace: z.string().optional(),
    type: z.enum(['Managed', 'Unlocked']),
    /** Permission sets (and/or permission set groups) to assign to the running user after package install in flow contexts. */
    permsets: z.array(z.string()).optional(),
    /** Glob pattern used to discover Apex test classes. Defaults to "*_Test". */
    testPattern: z.string().default('*_Test'),
    /** Packages to install before deploying or packaging. */
    dependencies: z.array(ShipDependencySchema).optional(),
  })
  .strict();

/** Git/GitHub configuration for the project. */
const ProjectGitConfigSchema = z.object({
  /** The main branch name. Defaults to `main`. */
  defaultBranch: z.string().optional(),
  /** The GitHub repository URL. */
  repoUrl: z.url().optional(),
});

/** Top-level project metadata within a ship config. */
const ProjectConfigSchema = z
  .object({
    /** URL/alias-safe slug used as a prefix for generated org aliases. Defaults to package.name lowercased with spaces replaced by hyphens. */
    slug: z.string().optional(),
    /** Optional Salesforce package metadata. */
    package: ProjectPackageConfigSchema.optional(),
    /** Optional Git repository configuration. */
    git: ProjectGitConfigSchema.optional(),
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
    /** Project metadata. */
    project: ProjectConfigSchema,
    /** Directory used to resolve custom tasks, scratch-org defs, and other ship assets. Defaults to `.ship`. */
    dir: z.string().default('.ship'),
  })
  .strict();

export type { ShipDependency };
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectPackageConfig = z.infer<typeof ProjectPackageConfigSchema>;
export type ProjectGitConfig = z.infer<typeof ProjectGitConfigSchema>;
/** The validated top-level ship configuration, inferred from {@link ShipConfigSchema}. */
export type ShipConfig = z.infer<typeof ShipConfigSchema>;
/* c8 ignore stop */
