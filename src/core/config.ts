/* c8 ignore start */
import { z } from 'zod';
import { ParamDefinitionSchema } from './param.js';

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

/** A scalar value or null that a condition can compare against. */
const FlowStepConditionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** Condition used in `if` / `if-not` step fields. Resolves a `${{ }}` token and optionally compares it to a value. */
const FlowStepConditionSchema = z
  .object({ value: z.string(), equals: FlowStepConditionValueSchema.optional() })
  .strict();

/** A single step within a flow definition. */
const FlowStepSchema = z
  .object({
    /** The task to execute, e.g. "util/log" or "org/scratch/create". */
    task: z.string(),
    /** Parameters passed to the task. */
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    /** Run step if condition is truthy (or equals a value). */
    if: FlowStepConditionSchema.optional(),
    /** Run step if condition is falsy (or equals a value). */
    'if-not': FlowStepConditionSchema.optional(),
  })
  .refine((s) => !(s.if && s['if-not']), { message: 'A step cannot have both "if" and "if-not"' });

/** Defines a named flow: its accepted params and the ordered steps to execute. */
const FlowDefinitionSchema = z.object({
  /** Human-readable description of what this flow does. */
  description: z.string().optional(),
  /** Params this flow accepts, passed as `--param key=value` CLI flags when invoking the flow. */
  params: z.array(ParamDefinitionSchema).optional(),
  /** Named steps to execute in definition order. The key is the step ID, used for output references. */
  steps: z.record(z.string(), FlowStepSchema),
});

/**
 * Zod schema for the top-level `ship.config.json` (or equivalent).
 * Defines the project, optional ship directory override, and named flows.
 */
export const ShipConfigSchema = z.object({
  /** Project metadata. */
  project: ProjectConfigSchema,
  /** Directory used to resolve custom tasks, scratch-org defs, and other ship assets. Defaults to `.ship`. */
  dir: z.string().default('.ship'),
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
/* c8 ignore stop */
