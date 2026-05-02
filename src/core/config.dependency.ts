/* c8 ignore start */
import { z } from 'zod';

/** A CumulusCI GitHub repository dependency. Resolves by fetching `cumulusci.yml` from the repo. */
export const CciGitHubDependencySchema = z.object({
  /** GitHub repository as a full URL or `owner/repo` slug. */
  github: z.string(),
  /** Pin to a specific release tag instead of resolving to latest. */
  tag: z.string().optional(),
  /** Deploy a specific subdirectory from the repo as unmanaged metadata instead of recursing into the config. */
  subfolder: z.string().optional(),
  /** Strip namespace tokens from metadata before deploying. Only meaningful with `subfolder`. */
  unmanaged: z.boolean().optional(),
});

/** A CumulusCI 1GP managed package dependency identified by namespace and version number. */
export const CciNamespaceDependencySchema = z.object({
  /** The package namespace (e.g. `npsp`). */
  namespace: z.string(),
  /** The version number (e.g. `3.232`). */
  version: z.string(),
});

/** A CumulusCI 2GP or unlocked package dependency identified by package version ID. */
export const CciVersionIdDependencySchema = z.object({
  /** The 04t package version ID. */
  // eslint-disable-next-line camelcase
  version_id: z.string(),
});

/** A single entry in a `cumulusci.yml` dependency list. */
export const CciDependencySchema = z.union([
  CciGitHubDependencySchema,
  CciNamespaceDependencySchema,
  CciVersionIdDependencySchema,
]);

/** A plugin-ship GitHub repository dependency. Resolves by fetching `ship.yml` or `cumulusci.yml` from the repo. */
export const ShipGitHubDependencySchema = z.object({
  /** GitHub repository as a full URL or `owner/repo` slug. */
  github: z.string(),
  /** Whether the repo uses plugin-ship or CumulusCI. Determines which config file is fetched. Defaults to `ship`. */
  type: z.enum(['ship', 'cci']).default('ship'),
  /** Pin to a specific release tag instead of resolving to latest. */
  tag: z.string().optional(),
  /** Deploy a specific subdirectory from the repo as unmanaged metadata instead of recursing into the config. */
  subfolder: z.string().optional(),
  /** Strip namespace tokens from metadata before deploying. Only meaningful with `subfolder`. */
  unmanaged: z.boolean().optional(),
  /** Human-readable label for this dependency, used to name the repo's own package step in log output. */
  name: z.string().optional(),
});

/** A plugin-ship 1GP managed package dependency identified by namespace and version number. */
export const ShipNamespaceDependencySchema = z.object({
  /** The package namespace (e.g. `npsp`). */
  namespace: z.string(),
  /** The version number (e.g. `3.232`). */
  version: z.string(),
  /** Human-readable label used in log output. */
  name: z.string().optional(),
});

/** A plugin-ship 2GP or unlocked package dependency identified by package version ID. */
export const ShipPackageIdDependencySchema = z.object({
  /** The 04t package version ID. */
  versionId: z.string(),
  /** Human-readable label used in log output. */
  name: z.string().optional(),
});

/** A single entry in a `ship.yml` dependency list. */
export const ShipDependencySchema = z.union([
  ShipGitHubDependencySchema,
  ShipNamespaceDependencySchema,
  ShipPackageIdDependencySchema,
]);

export type CciGitHubDependency = z.infer<typeof CciGitHubDependencySchema>;
export type CciNamespaceDependency = z.infer<typeof CciNamespaceDependencySchema>;
export type CciVersionIdDependency = z.infer<typeof CciVersionIdDependencySchema>;
export type CciDependency = z.infer<typeof CciDependencySchema>;
export type ShipGitHubDependency = z.infer<typeof ShipGitHubDependencySchema>;
export type ShipNamespaceDependency = z.infer<typeof ShipNamespaceDependencySchema>;
export type ShipPackageIdDependency = z.infer<typeof ShipPackageIdDependencySchema>;
export type ShipDependency = z.infer<typeof ShipDependencySchema>;
/* c8 ignore stop */
