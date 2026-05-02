/* c8 ignore start */
import { z } from 'zod';
import { CciDependencySchema } from './config.dependency.js';

export const CumulusCISchema = z.object({
  project: z.object({
    dependencies: z.array(CciDependencySchema).optional(),
  }),
});

export type CumulusCI = z.infer<typeof CumulusCISchema>;
/* c8 ignore stop */
