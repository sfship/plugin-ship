import { z } from 'zod';

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
  repoUrl: z.string().url().optional(),
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

/** A single step within a flow definition. */
const FlowStepSchema = z.object({
  /** The action to execute, e.g. "util:log" or "myCustomAction". */
  action: z.string(),
  /** Optional human-readable label for this step. */
  label: z.string().optional(),
  /** Parameters passed to the task. */
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/** Defines a named flow: its accepted params and the ordered steps to execute. */
const FlowDefinitionSchema = z.object({
  /** Param names this flow accepts, passed as CLI flags when invoking the flow. */
  params: z.array(z.string()).optional(),
  /** Ordered list of steps to execute. */
  steps: z.array(FlowStepSchema),
});

/**
 * Zod schema for the top-level `ship.config.json` (or equivalent).
 * Defines the project, optional ship directory override, and named flows.
 */
export const ShipConfigSchema = z.object({
  /** Project metadata. */
  project: ProjectConfigSchema,
  /** Directory used to resolve custom tasks, scratch-org defs, and other ship assets. Defaults to `.ship`. */
  dir: z.string().optional(),
  /** Named flows, each consisting of an ordered list of steps to execute. */
  flows: z.record(z.string(), FlowDefinitionSchema).optional(),
});

export type FlowStep = z.infer<typeof FlowStepSchema>;
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectPackageConfig = z.infer<typeof ProjectPackageConfigSchema>;
export type ProjectGitConfig = z.infer<typeof ProjectGitConfigSchema>;
/** The validated top-level ship configuration, inferred from {@link ShipConfigSchema}. */
export type ShipConfig = z.infer<typeof ShipConfigSchema>;
