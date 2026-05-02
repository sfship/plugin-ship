/* c8 ignore start */
import { z } from 'zod';
import { ShipDependencySchema, ShipDependency } from './config.dependency.js';

/** Salesforce packaging metadata for the project. */
const ProjectPackageConfigSchema = z.object({
  /** The package name as it appears in the Salesforce packaging UI. */
  name: z.string(),
  /** The package namespace. */
  namespace: z.string().optional(),
});

/** Git/GitHub configuration for the project. */
const ProjectGitConfigSchema = z.object({
  /** The main branch name. Defaults to `main`. */
  defaultBranch: z.string().optional(),
  /** The GitHub repository URL. */
  repoUrl: z.url().optional(),
});

/** Top-level project metadata within a ship config. */
const ProjectConfigSchema = z.object({
  /** The project name, used as a prefix for generated aliases etc. */
  name: z.string(),
  /** Optional Salesforce package metadata. */
  package: ProjectPackageConfigSchema.optional(),
  /** Optional Git repository configuration. */
  git: ProjectGitConfigSchema.optional(),
});

/**
 * Zod schema for the top-level `ship.yml`.
 * Defines the project and optional ship directory override.
 */
export const ShipConfigSchema = z.object({
  /** Project metadata. */
  project: ProjectConfigSchema,
  /** Directory used to resolve custom tasks, scratch-org defs, and other ship assets. Defaults to `.ship`. */
  dir: z.string().default('.ship'),
  /** Dependencies to install before deploying or packaging. */
  dependencies: z.array(ShipDependencySchema).optional(),
});

export type { ShipDependency };
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectPackageConfig = z.infer<typeof ProjectPackageConfigSchema>;
export type ProjectGitConfig = z.infer<typeof ProjectGitConfigSchema>;
/** The validated top-level ship configuration, inferred from {@link ShipConfigSchema}. */
export type ShipConfig = z.infer<typeof ShipConfigSchema>;
/* c8 ignore stop */
