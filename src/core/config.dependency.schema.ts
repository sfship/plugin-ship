/*
 * Copyright 2026, Salesforce, Inc.
 *
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

import { z } from 'zod';

/** A plugin-ship GitHub repository dependency. Resolves via the annotated tag message on the latest (or pinned) release. */
export const ShipGitHubDependencySchema = z.object({
  /** GitHub repository as a full URL or `owner/repo` slug. */
  github: z.string(),
  /** Pin to a specific release tag instead of resolving to latest. */
  tag: z.string().optional(),
  /** Human-readable label for this dependency, used to name the repo's own package step in log output. */
  name: z.string().optional(),
});

/** A plugin-ship package dependency identified by package version ID. */
export const ShipPackageIdDependencySchema = z.object({
  /** The 04t package version ID. */
  versionId: z.string(),
  /** Human-readable label used in log output. */
  name: z.string().optional(),
});

/** A single entry in a `ship.yml` dependency list. */
export const ShipDependencySchema = z.union([ShipGitHubDependencySchema, ShipPackageIdDependencySchema]);

export type ShipGitHubDependency = z.infer<typeof ShipGitHubDependencySchema>;
export type ShipPackageIdDependency = z.infer<typeof ShipPackageIdDependencySchema>;
export type ShipDependency = z.infer<typeof ShipDependencySchema>;
/* c8 ignore stop */
