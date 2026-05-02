## Tasks

### `org/`

| Path                              | What it does                                           |
| --------------------------------- | ------------------------------------------------------ |
| `org/scratch/create`              | _(have)_                                               |
| `org/scratch/delete`              | _(have)_                                               |
| `org/permission-set/assign`       | Assign one or more permission sets to the running user |
| `org/permission-set-group/assign` | Assign permission set groups to the running user       |
| `org/admin-profile/update`        | Retrieve and redeploy Admin profile with full FLS      |

### `metadata/`

| Path              | What it does                                 |
| ----------------- | -------------------------------------------- |
| `metadata/deploy` | _(have — keep it pure: path in, deploy out)_ |

### `package/` (2GP/unlocked only)

| Path                           | What it does                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package/version/ancestor`     | Queries Dev Hub for latest promoted version, outputs `ancestor-version-id` and `next-version-number`. Param: `bump` (`major`\|`minor`, default `minor`).                                                                                                             |
| `package/version/create`       | Resolves dependencies from `ship.yml`, injects them into `sfdx-project.json`, runs package version create with `--version-number` and `--ancestor-id` flags, restores file. Sets `SFDX_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_VERSION_CREATE`. Outputs: `version-id` |
| `package/version/promote`      | Promote a package version to production-ready                                                                                                                                                                                                                        |
| `package/install`              | Install a package version into an org                                                                                                                                                                                                                                |
| `package/uninstall`            | Uninstall a managed or unlocked package                                                                                                                                                                                                                              |
| `package/dependencies/install` | Resolves and installs all dependencies declared in `ship.yml` in topological order, including transitive dependencies                                                                                                                                                |

### `apex/`

| Path            | What it does                      |
| --------------- | --------------------------------- |
| `apex/test/run` | _(have)_                          |
| `apex/execute`  | Run anonymous Apex against an org |

### `github/`

| Path                            | What it does                               |
| ------------------------------- | ------------------------------------------ |
| `github/repo/info`              | _(have)_                                   |
| `github/release/create`         | Create a GitHub release with tag and notes |
| `github/release-notes/generate` | Aggregate release notes from merged PRs    |

### `fs/`

| Path        | What it does             |
| ----------- | ------------------------ |
| `fs/copy`   | Copy file or directory   |
| `fs/delete` | Delete file or directory |

### `sys/`

| Path   | What it does         |
| ------ | -------------------- |
| `log`  | _(have)_             |
| `exec` | Executes CLI command |

### `namespace/`

| Path      | What it does                                                                              |
| --------- | ----------------------------------------------------------------------------------------- |
| `resolve` | Reads namespace from `sfdx-project.json`, sets `NAMESPACE_PREFIX` env var (e.g. `myns__`) |

---

## Flows

| Name                       | What it orchestrates                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `dev-org`                  | `org/scratch/create` → `metadata/deploy` (pre) → `metadata/deploy` → `metadata/deploy` (post) → `org/permission-set/assign` |
| `release/2gp/beta`         | `package/version/ancestor` → `namespace/resolve` → `package/version/create` → `apex/test/run` → `github/release/create`     |
| `release/2gp/promote`      | `package/version/promote` → `github/release/create`                                                                         |
| `release/unlocked/beta`    | Same as `release/2gp/beta` for unlocked packages                                                                            |
| `release/unlocked/promote` | `package/version/promote` → `github/release/create`                                                                         |

**Version management:** The Dev Hub is the source of truth for version history. `package/version/ancestor` queries `sf package version list --released` to find the latest promoted version, then computes the next version number. It outputs `ancestor-version-id` and `next-version-number` which `package/version/create` consumes as flags — `sfdx-project.json` is never mutated for version management. Developers never touch `versionNumber` in `sfdx-project.json`; they only pass `bump=major` when cutting a breaking release.

**Namespace handling:** Namespace token replacement is handled natively by the `replacements` field in `sfdx-project.json` (`allowUnsetEnvVariable: true`). Dev org deploys require no namespace task — the prefix is stripped automatically when `NAMESPACE_PREFIX` is unset. `namespace/resolve` is only needed in packaging flows, where it sets `NAMESPACE_PREFIX` so sf CLI injects the namespace during `package/version/create`.

**`sfdx-project.json` conventions:** Consumers configure `replacements`, `packageDirectories` (with `definitionFile` pointing to `orgs/<name>.json`), and a single `packageAliases` entry for the package ID. `versionNumber` is not required — always passed as a flag. `package/version/create` suppresses automatic alias updates via `SFDX_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_VERSION_CREATE`.

**Pre/post deploy:** The `dev-org` flow deploys `unpackaged/pre`, `force-app`, and `unpackaged/post` as separate steps. These directories are optional — consumers include or omit them based on their project structure.

**Dependency management:** Dependencies are declared in `ship.yml` under a `dependencies` key. Three forms are supported:

```yaml
dependencies:
  - github: SalesforceFoundation/NPSP
    type: cci # reads cumulusci.yml for dependency tree
  - github:
      myorg/my-other-package
      # type defaults to ship — reads ship.yml
    tag: v1.2.0 # optional: pin to a specific release instead of latest
  - id: 04tXXXXXXXXXXXXX
    name: Some Simple Package # plain package ID, no config fetched, no recursion
```

`package/dependencies/install` walks the full transitive dependency tree, topological sorts, and installs in order. For `type: cci`, it reads `cumulusci.yml` from the GitHub repo and extracts its dependency list. For `type: ship`, it reads `ship.yml`. For plain `id` entries, it installs directly. `package/version/create` also uses this resolver to inject resolved dependencies into `sfdx-project.json` before creating the package version (try/finally restore).

`sfdx-project.json` should NOT contain `dependencies` or `versionNumber` — plugin-ship warns if it finds them populated.

**oclif in-process command invocation:** `this.config.runCommand('package:version:create', [...flags])` runs an sf CLI command in-process without spawning a child process. Since tasks receive `TaskContext` not an oclif `Command`, `config` will be threaded through `TaskContext` so tasks can invoke sf CLI commands programmatically where needed. Shell-out via `sys/exec` remains the default; in-process invocation is available for cases where it's cleaner.

CI flows are a consumer concern — wire up `release/2gp/beta`, a test run, and a delete in your own flow.
