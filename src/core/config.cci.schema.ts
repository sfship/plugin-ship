/* c8 ignore start */
import { z } from 'zod';
import { CciDependencySchema } from './config.dependency.schema.js';

/**
 * Partial schema for a `cumulusci.yml` file.
 * Only the `project.dependencies` section is parsed — all other fields are ignored.
 */
export const CumulusCISchema = z.object({
  project: z.object({
    /** The list of dependencies for this CumulusCI project. */
    dependencies: z.array(CciDependencySchema).optional(),
  }),
});

/** The parsed subset of a `cumulusci.yml` file used by the dependency resolver. */
export type CumulusCI = z.infer<typeof CumulusCISchema>;
/* c8 ignore stop */
