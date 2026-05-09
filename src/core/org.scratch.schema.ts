/* c8 ignore start */
import { z } from 'zod';

/** Valid sharing models for a Salesforce scratch org object. */
const ScratchOrgSharingModelSchema = z.enum([
  'private',
  'read',
  'readWrite',
  'readWriteTransfer',
  'fullAccess',
  'controlledByParent',
  'controlledByCampaign',
  'controlledByLeadOrContent',
]);

/** Per-object settings that can be applied to a scratch org definition. */
const ScratchOrgObjectSettingSchema = z.object({
  sharingModel: ScratchOrgSharingModelSchema.optional(),
  defaultRecordType: z.string().optional(),
});

/**
 * Zod schema for a Salesforce scratch org definition file.
 * Mirrors the shape of a `project-scratch-def.json`, with strict validation
 * on known fields and `catchall` to allow unknown Salesforce-specific extensions.
 */
export const ScratchOrgDefSchema = z
  .object({
    /** The Salesforce edition for the scratch org. */
    edition: z.enum(['Developer', 'Enterprise', 'Group', 'Professional']),
    orgName: z.string().optional(),
    country: z.string().optional(),
    username: z.string().optional(),
    adminEmail: z.email().optional(),
    /** Max 2000 characters. */
    description: z.string().max(2000).optional(),
    hasSampleData: z.boolean().optional(),
    language: z.string().optional(),
    /** List of Salesforce features to enable (e.g. `'Communities'`, `'LightningSalesConsole'`). */
    features: z.array(z.string()).optional(),
    release: z.enum(['preview', 'previous']).optional(),
    /** Org-wide settings, keyed by settings API name. */
    settings: z.record(z.string(), z.unknown()).optional(),
    /** Per-object sharing and record type settings. */
    objectSettings: z.record(z.string(), ScratchOrgObjectSettingSchema).optional(),
    /** Name of an org snapshot to create the scratch org from. */
    snapshot: z.string().optional(),
    /** 15-character org ID of a source org to copy settings from. */
    sourceOrg: z.string().length(15).optional(),
  })
  .catchall(z.unknown());

/** A validated scratch org definition, inferred from {@link ScratchOrgDefSchema}. */
export type ScratchOrgDef = z.infer<typeof ScratchOrgDefSchema>;
/* c8 ignore stop */
