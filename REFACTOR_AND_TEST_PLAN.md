# Refactor & Test Plan

Guidance for the refactor + test pass following the feature-complete milestone. Written so a future session (human or Claude) can pick up cold without re-deriving the goals and constraints. Companion to `2GP_FLOW_PLAN.md` (which describes the flow/task catalog).

## Where things stand — done, don't redo

A cleanup pass plus one new feature landed already:

- **Dead code removed.** The orphaned CumulusCI config-parsing chain (`config.cci.schema.ts` and the `Cci*` schemas in `config.dependency.schema.ts`), plus unused exports (`writeText`, `getGithubMeta`/`GithubMeta`, `GithubUser`).
- **shipDir resolution unified.** Every command goes through `resolveProjectPaths(configPath, config)` in `config.loader.ts`. Previously duplicated across 7 commands and had drifted — `flow/task info` + `list` resolved `.ship` relative to cwd while `run`/`eject` resolved it relative to the config file, so `--config some/dir/ship.yml` looked in the wrong place.
- **Interpolation consolidated.** `util.interpolate.ts` owns `deepGet`, `resolvePureToken`, `interpolate`; `flow.store.ts` and `flow.runner.ts` import it instead of each keeping a copy.
- **Name normalization consolidated.** `util.path.ts` owns `normalizeName`, which now lowercases for cross-OS consistency. Both `task.registry.ts` and `flow.registry.ts` normalize keys and lookups through it. Fixed a real bug: `task.registry.resolveTask` wasn't normalizing input at all.
- **Dependency sync/verify feature.** `sfdx-project.ts` (read / write / `defaultPackageDirectory`), `package/dependencies/sync` (resolve ship.yml deps → write into sfdx-project.json), `package/dependencies/verify` (drift gate), the `dependencies/sync` flow, and `verify-dependencies` wired as the first step of `release/beta`. Rationale: a _validated_ `package version create` reads dependencies from sfdx-project.json, not ship.yml. ship.yml stays the source of truth; sfdx-project.json is a synced/derived "lockfile"; `verify` fails the build if they drift.
- **Friendlier errors.** `promote` maps the beta propagation-delay error to a calm "wait and retry" message; `verify` prints a diff-style drift report with package names.

## Refactor goals (priority order)

### 1. Unify all sfdx-project.json access onto `sfdx-project.ts`

Four places still touch sfdx-project.json independently and have drifted:

- `project.init.ts` `patchSfdxProjectJson` — sets `package`/`versionName`/`versionNumber`, and `ancestorVersion: "HIGHEST"` for **managed only**; writes **4-space**.
- `tasks/package/create.ts` — reads/writes `packageAliases`; writes **2-space**.
- `tasks/package/version/create.ts` `getDefaultPackageAlias` — reads the default dir's `package`.
- `tasks/package/dependencies/{sync,verify}.ts` — already on `sfdx-project.ts`.

Route them all through `sfdx-project.ts`. **Pick one canonical indentation** and make `writeSfdxProject` own it — today a 4-space init'd file gets silently reformatted to 2-space the first time `create/package` writes, producing noisy diffs. `defaultPackageDirectory` already covers the "find the default dir" duplication.

Guardrail: `create/package` stays narrow — register the package + write the alias, nothing else. Ancestry is `init`'s job; do not move it into `create/package` (we tried, reverted).

### 2. Thin out the `util.*` namespace

Seven `util.*` files now, and a couple aren't really generic utilities. Directional, do only if it improves clarity:

- `util.path` (normalizeName) and `util.tree` (renderTree) both operate on the slash-separated task/flow naming scheme — candidate to merge into one domain module (e.g. `naming.ts`).
- `util.interpolate` is substantial enough to drop the prefix (`interpolate.ts`).
- Keep `util.*` for the genuinely-miscellaneous thin wrappers (`util.file`, `util.stdout`).

### 3. Small accuracy fixes to fold in

- `resolve-next.ts` description claims ancestry is "scaffolded by `package/create`" — now false (it's `init`). Repoint it.
- `project.init.ts` scaffolds a README containing a literal `TODO` ("## Documentation" section). Fill or drop it before release.

### 4. Typed params

Tasks read params as `params['foo'] as string` — safe only because `validateParams()` enforces the declared types at runtime, which TypeScript can't see. A generic `Task<P>` could give typed param access; possibly over-engineering, so decide during the refactor. (The one live entry in the `pinned_issues` memory.)

## Testing goals

**Coverage gotcha, read first.** `.c8rc` enforces lines/statements/functions **90** and branches **75**, but has **no `all: true`** — c8 only measures files actually loaded during a test run. Untested files (the registries, most tasks, the new modules) currently pass _by omission_. The moment a test imports one of them, it enters the measured set and must clear 90/75. Budget enough cases per file or the gate fails even though the feature works.

Stack: mocha + esmock for mocking ESM imports (`util.file`, `flow.runCommand`, etc.). Copy the patterns in `config.loader.test.ts` (mocks `readText`) and `flow.runner.test.ts` (mocks the renderer + `TaskRegistry`).

Priority order:

1. **Dependency feature — highest risk, it writes to sfdx-project.json:**
   - `sfdx-project.ts`: read/write round-trip, `defaultPackageDirectory` (default flag vs first entry), trailing-newline preservation.
   - `sync`: writes named `packageAliases` + `dependencies`, raw-04t fallback for unnamed deps, clears deps when ship.yml has none, the "no package registered" guard.
   - `verify`: in-sync pass, missing/stale set diff, name resolution from both sides, alias→04t resolution, the thrown `ExpectedError`.
2. **Registries** (untested today; behavior changed with lowercasing): name resolution (case-insensitive, `\`→`/`, leading slash), consumer-shadows-builtin, `builtinSource`/eject lookup, unknown-name error.
3. **`util.path` / `util.interpolate`**: normalizeName cases; interpolate pure-token / mixed-string / object / non-string / missing-path (much is already exercised via `flow.store.test.ts` — confirm and fill gaps).
4. **Tasks with real logic** (skip thin passthroughs): `resolve-next` (semver bump, build-vs-minor reseries), `git/release/create` (tag-annotation block, `previous_tag_name`, `getFirstCommitSha` pagination), `package.resolver` (transitive flatten, circular detection, pre/post ordering — already has a test, check coverage), `org/create/scratch` (existing-org healthy/expired paths), `apex/run/test` (coverage gate, class-name namespacing), `util/file/find` (glob→regex), `package/version/create` (default-package fallback).
5. **`promote`**: propagation-delay mapping (the specific error → friendly message; any other error rethrows untouched).
6. **`project.init.ts`**: scaffold outputs (managed ancestry, org defs, gitignore append).

## Guardrails (respect these)

- **Never run build/install commands** — the user builds continuously themselves.
- `ExpectedError` for user-facing failures; plain `Error` only for unexpected bugs (the flow renderer suppresses the stack for `ExpectedError`).
- kebab-case for task/param names and outputs.
- No composed flows (a step references a `task`, never another flow); tasks are granular single-`sf`-command passthroughs.
- `create/package` stays narrow (register + write alias). Migrating an existing package is a **docs** concern — "here's how to lay out your migrated project" — not a code path to defend.
- Dependencies live at `project.package.dependencies`. ship.yml is the source of truth; sfdx-project.json deps are synced/derived; `verify` guards drift.
- Beta promote can transiently fail with "no corresponding Package Version Id" — Salesforce propagation delay, not a bug.
- Tone in docs and messages: direct prose, no tech-bro headers / category labels / heavy bolding.

## Stale docs to reconcile (separate docs pass — not part of refactor/test)

- `2GP_FLOW_PLAN.md`: lists `init` and a regression flow as "open" (both are built); omits the dependency sync/verify feature entirely; describes `package/create` calling `setAncestorHighest`/`normalizeSfdxProject` (functions that don't exist — ancestry is `init`'s).
- `README.md`: no mention of `dependencies/sync` or the sync-before-release lifecycle; the command list omits `project init` and the newer flows.
