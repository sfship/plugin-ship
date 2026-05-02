/* c8 ignore start */
import { z } from 'zod';

export const CciGitHubDependencySchema = z.object({
  github: z.string(),
  tag: z.string().optional(),
  subfolder: z.string().optional(),
  unmanaged: z.boolean().optional(),
});

export const CciNamespaceDependencySchema = z.object({
  namespace: z.string(),
  version: z.string(),
});

export const CciVersionIdDependencySchema = z.object({
  // eslint-disable-next-line camelcase
  version_id: z.string(),
});

export const CciDependencySchema = z.union([
  CciGitHubDependencySchema,
  CciNamespaceDependencySchema,
  CciVersionIdDependencySchema,
]);

export const ShipGitHubDependencySchema = z.object({
  github: z.string(),
  type: z.enum(['ship', 'cci']).default('ship'),
  tag: z.string().optional(),
  subfolder: z.string().optional(),
  unmanaged: z.boolean().optional(),
});

export const ShipNamespaceDependencySchema = z.object({
  namespace: z.string(),
  version: z.string(),
  name: z.string().optional(),
});

export const ShipPackageIdDependencySchema = z.object({
  versionId: z.string(),
  name: z.string().optional(),
});

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
