# plugin-ship — flow & task state

A modern, sf-native take on CCI's 2GP packaging flows. The flow catalog is small and intentionally so. This doc is the current state, not the original work plan — most of what's described is already implemented.

## Flow catalog

All flows use **verb-noun nested paths** (`deploy/dev`, `release/beta`, etc.), not CCI-style flat suffixed names.

| Flow                 | CCI lineage                                                                      | Purpose                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `setup/package`      | (new — no CCI counterpart)                                                       | One-time: register the 2GP package on the Dev Hub, scaffold `ancestorVersion: "HIGHEST"` into sfdx-project.json |
| `deploy/dev`         | `dev_org`                                                                        | Provision a namespaced dev scratch (`dev.json`), install deps, deploy `force-app`, optionally seed data         |
| `deploy/qa`          | `qa_org_2gp`                                                                     | Install the latest beta + deps into a provided org (target-org param)                                           |
| `deploy/feature`     | `ci_feature_2gp` + `build_feature_test_package` (collapsed into one atomic flow) | Build a version (or reuse one passed via `version-id`), install deps, install, run Apex tests                   |
| `release/beta`       | `release_2gp_beta`                                                               | Resolve next version → build → tag + GitHub release (prerelease)                                                |
| `release/production` | `release_2gp_production`                                                         | Find latest beta → promote → tag + GitHub release with semver-triple tag (e.g. `v0.1.0`)                        |

Deliberately not built:

- A `regression`-style flow (would use a `release.json` scratch def to install latest production). Scratch def is sketched; flow can be added when needed.
- `build-2gp` as a standalone flow — folded into `deploy/feature` since "build then install/test" with the implicit "latest beta" handoff was a foot-gun.

## Task catalog

Built and in use:

- **org/create/scratch** — wraps `scratchOrgCreate` from `@salesforce/core`. Reads namespace from `sfdx-project.json` and injects it into `orgConfig` (the library's auto-lookup is unreliable in our in-process context). `no-namespace: true` param opts out (for feature/beta orgs that install a managed package of the same namespace).
- **org/delete/scratch** — passthrough.
- **package/create** — registers a 2GP package on the Dev Hub via `sf package create`. Idempotent (skips if name already in `packageAliases`). Calls `normalizeSfdxProject` to strip versionName/Number/Description that sf injects, then `setAncestorHighest` to write `ancestorVersion: "HIGHEST"` onto the default packageDirectory. That's the one and only time we write to sfdx-project.json — afterwards, sf auto-resolves the ancestor on every version create.
- **package/version/list** — passthrough to `sf package version list`. Defensively handles the `IsReleased` field coming back as the string `"true"/"false"` (in-process runCommand quirk in this CLI version). Outputs `version-id`, `version-number` (full, e.g. `0.1.0.4`), and `version-base` (semver triple, e.g. `0.1.0`) — the last for production release tags.
- **package/version/create** — passthrough to `sf package version create`. Reads default package alias from sfdx-project.json (sf doesn't auto-fall-back). No ancestor handling — that's owned by `ancestorVersion: "HIGHEST"` in sfdx-project.json.
- **package/version/promote** — passthrough to `sf package version promote`.
- **package/version/resolve-next** — reads the latest GitHub release, parses semver from the tag name, bumps `major`/`minor`/`patch`/`build` per the `version-type` param, and outputs `version-number` ending in `.NEXT` (sf assigns the build slot). No ancestor output — handled via HIGHEST.
- **package/install** — passthrough.
- **package/install/dependencies** — resolves the ship.yml dependency tree (via `package.resolver.ts`) and installs missing ones. Skips both `package-id` and `metadata` (CCI-style `unpackaged/pre|post`) steps whose 04t is already in the org's `package installed list`.
- **apex/run/test** — passthrough.
- **data/import/tree** — passthrough to `sf data import tree`. No-ops if neither `plan` nor `files` is set.
- **project/deploy/start** — passthrough. Used directly for `unpackaged/pre|post` bundles via the check-pre/check-post pattern (see "decisions" below).
- **project/reset/tracking** — passthrough. ⚠️ See source-tracking caveat below. Not currently used in any flow.
- **git/repo/info** — fetches GitHub repo info. Renamed from `github/repo/info` so the `git/` namespace stays host-agnostic if we ever add GitLab support.
- **git/release/create** — does three things in sequence: (1) create an annotated git tag carrying the CCI-format version metadata block (`version_id`, `package_type`, `dependencies` JSON), (2) create the tag reference, (3) create the GitHub release. For production releases (`prerelease: false`), passes `previous_tag_name` = the most recent non-prerelease release (or the repo's first commit SHA if none exists) so auto-generated notes skip prereleases. Prepends an "Installation Info" section (sandbox + production install URLs) to the release body by default; `install-link: false` opts out. `body` param controls whether to also auto-generate (omit → auto-gen on; provide → off).
- **env/set** — sets `process.env` for the rest of the flow run. The runtime primitive for the namespaceless token-replacement opt-in (see [[namespaced-scratch-default]] memory) and any other `replaceWithEnv`-based string substitution.
- **util/file/exists** — checks whether a path exists; outputs `exists` boolean for use in step `if` gates.
- **util/log** — logs a message.
- **metadata/deploy, metadata/prepare** — older passthroughs; still around but not central.

Deliberately not built:

- **metadata/deploy/bundles** — covered by `project/deploy/start` plus a `util/file/exists` precheck (see `qa-org-2gp` for the pattern). No iteration over subdirs; modern projects don't use CCI's multi-subbundle convention.
- **org/admin-profile/update** — modern equivalent is shipping permission sets in source. Drop.
- **git/release/notes** — auto-generation via GitHub's API (in `git/release/create`) covers it. No need for a CCI-style PR-parsing notes generator.
- **git/branch/merge** — no auto-merge by design (see decisions).

Already built and reused from before this work: `org/create/scratch`, `package/install`, `package/install/dependencies`, `project/deploy/start`, `apex/run/test`.

## Design decisions (load-bearing)

1. **No composed flows.** Each flow step references a `task`, never another flow. Saving the ~40 lines of YAML composition would have nets to save isn't worth ~200 lines of runtime (schema union, expansion pass, intra-flow token rewriting, cycle detection). Drift across the small flow catalog is manageable. Revisit only if the catalog grows much further.
2. **sfdx-native, so dropped from CCI:** `dx_convert_from`, `create_managed_src`/`revert_managed_src`, `unschedule_apex`, `update_package_xml`, `uninstall_packaged_incremental`. All 1GP/packaging-org artifacts.
3. **Granular passthroughs.** Each task wraps a single `sf` subcommand cleanly. Composite CCI tasks (`create_package_version` doing version-resolution + ancestor-resolution + sf invocation) split into focused steps composed in the flow YAML.
4. **No auto-merge.** CCI's `github_automerge_main`/`github_automerge_feature` are not inherited. Merging stays an explicit PR step.
5. **Namespaced scratch default.** sf-native default — `org/create/scratch` inherits `sfdx-project.json`'s namespace. CCI was the one going out of its way to opt out. The `no-namespace` param exists for feature/beta orgs that install a managed package of the same namespace.
6. **Version state lives outside sfdx-project.json.** Not in source — `package/create` scaffolds `ancestorVersion: "HIGHEST"` once and that's it. `version-number` is passed as a CLI flag on every `sf package version create`, computed by `package/version/resolve-next` from the latest GitHub release. `normalizeSfdxProject` strips the `versionName`/`versionNumber`/`versionDescription` fields and `@<version>` `packageAliases` entries that sf writes during create.
7. **CCI tag-annotation format inherited verbatim.** `git/release/create` writes `version_id: 04t…`, `package_type: 2GP`, `dependencies: [...]` into the annotated tag message. The resolver (`package.resolver.ts`) reads the same format for any GitHub dep — there's no longer a `type: 'ship' | 'cci'` distinction on the dep schema. CCI projects can depend on ship projects and vice versa transparently.
8. **Native sfdx-project.json `replacements` for string substitution**, not a custom token engine. `env/set` is the runtime primitive. The namespaceless-with-tokens path (`%%%NAMESPACE%%%`-style) is a documented opt-in for migrators, not a default — the default 2GP-namespaced path doesn't need it (hardcode `ns__` literally).
9. **GitHub release notes auto-generated** via the API's `generate_release_notes: true`. For production releases, we explicitly pass `previous_tag_name` (most recent non-prerelease, or first commit SHA) so the diff window covers the right range, ignoring intervening betas. "Installation Info" with sandbox/production install URLs is prepended to the body by default.
10. **`reset-tracking` not in any flow.** It works fine standalone (`sf project reset tracking` in a terminal) but is unreliable when invoked in-process from the flow runner — appears to be SDR/`@salesforce/source-tracking` cross-process state issues, not specific to us (same symptom with VS Code's deploy command). The task exists if a consumer wants it, but `deploy/dev` doesn't end with it. The real tool for managing retrieve noise is a scaffolded `.forceignore`.

## Scratch defs

Scaffolded in `.ship/orgs/` of consumer projects. Currently dev is the only one we've authored.

- **dev.json** — namespaced (inherits from sfdx-project.json). `hasSampleData: true`, `enableAdminLoginAsAnyUser`, `forceRelogin: false`, `permsetsInFieldCreation`, `enableEnhancedPermsetMgmt`. Used by `deploy/dev`.
- **feature.json** — minimal CI scratch. Used when a future flow auto-creates throwaway feature orgs; would pass `no-namespace: true` to `org/create/scratch`.
- **beta.json** — QA tester's org for the `deploy/qa` install target. Sample data + dev convenience settings; `no-namespace: true`.
- **release.json** — placeholder for a future regression flow (install latest production). Same shape as beta.

## Open items

- `.forceignore` scaffolding for managed-package noise in `setup/package` or via a future `init` flow.
- A `regression`-style flow that installs the latest production release and runs tests against it (would use `release.json` scratch def + `package/version/list released:true` + `package/install` + `apex/run/test`).
- The "init / new project" flow — scaffolds ship.yml, .ship/, sfdx-project.json starter, scratch defs, .forceignore — when we want to make project onboarding more discoverable.

## Memory pointers

Project decisions recorded in `MEMORY.md`:

- [[no-composed-flows]] — design note 1
- [[namespaced-scratch-default]] — design note 5 (+ scratch defs)
- [[no-automerge]] — design note 4
- [[plugin-ship-architecture]] — Task class system, FlowContext, key files
- [[code-style-preferences]] — no redundant casts, no unnecessary helpers, no Agent tool for direct edits
- [[naming-convention]] — kebab-case for task/param names
- [[build-commands]] — never run yarn/npm install or build
- [[expected-error]] — user-facing failures throw ExpectedError, plain Error only for unexpected bugs
- [[tone]] — direct prose, no tech-bro headers/bolding/category labels
