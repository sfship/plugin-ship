---
title: Tasks
description: Reference for all built-in tasks.
---

## apex/run/test

Runs Apex tests against the target org. Passthrough for `sf apex run test`.

| Param          | Type   | Required | Description                                                                                              |
| -------------- | ------ | :------: | -------------------------------------------------------------------------------------------------------- |
| `target-org`   | string |          | Org alias or username. Defaults to the SF CLI default target-org.                                        |
| `test-level`   | string |          | Apex test level. Defaults to `RunSpecifiedTests` when `class-names` is set, otherwise `RunLocalTests`.   |
| `class-names`  | string |          | Comma-separated test class names. Required when `test-level` is `RunSpecifiedTests`.                     |
| `namespace`    | string |          | Namespace prefix to prepend to each class name. Defaults to `project.package.namespace` from `ship.yml`. |
| `wait`         | number |          | Minutes to wait for the test run to complete. Defaults to 15.                                            |
| `min-coverage` | number |          | Minimum org-wide coverage percentage (0–100). Fails the step if not met.                                 |

---

## data/import/tree

Imports records into an org from tree/plan files. Passthrough for `sf data import tree`. See [Salesforce Documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_data_tree.htm) for file format.

| Param        | Type   | Required | Description                                                                                          |
| ------------ | ------ | :------: | ---------------------------------------------------------------------------------------------------- |
| `target-org` | string |          | Org alias or username. Defaults to the SF CLI default target-org.                                    |
| `plan`       | string |          | Path to a plan file. Defaults to `.ship/data/plan.json` if present; otherwise the import is skipped. |
| `files`      | string |          | Comma-separated tree JSON files to import. Alternative to `plan`.                                    |

---

## git/release/create

Creates an annotated git tag carrying package version metadata, then a GitHub release pointing to it. Tag annotation format is compatible with CumulusCI.

| Param          | Type    | Required | Description                                                                        |
| -------------- | ------- | :------: | ---------------------------------------------------------------------------------- |
| `tag`          | string  |    ✓     | Tag name to create (e.g. `v1.2.3`).                                                |
| `version-id`   | string  |    ✓     | `04t` SubscriberPackageVersionId to embed in the tag annotation.                   |
| `package-type` | string  |          | Package type written into the annotation. Defaults to `2GP`.                       |
| `prerelease`   | boolean |          | Mark the GitHub release as a prerelease. Defaults to `false`.                      |
| `name`         | string  |          | Release name. Defaults to the tag.                                                 |
| `body`         | string  |          | Release body. When omitted, GitHub auto-generates notes.                           |
| `install-link` | boolean |          | Prepend a Salesforce package-install link to the release body. Defaults to `true`. |
| `target`       | string  |          | Commit SHA or branch to tag. Defaults to the repository's default branch.          |
| `repo-url`     | string  |          | GitHub repository URL. Falls back to `config.project.git.repoUrl`.                 |
| `github-alias` | string  |          | GitHub token alias. Defaults to `default`.                                         |

**Outputs**

- `tag` — The created tag name.
- `release-url` — URL of the created GitHub release.

---

## git/release/fetch

Resolves a package version ID from the latest GitHub release or pre-release.

| Param        | Type    | Required | Description                                                             |
| ------------ | ------- | :------: | ----------------------------------------------------------------------- |
| `prerelease` | boolean |          | When `true`, resolves from the latest pre-release. Defaults to `false`. |
| `tag`        | string  |          | Specific release tag to resolve. Overrides `prerelease`.                |
| `repo-url`   | string  |          | GitHub repository URL. Falls back to `config.project.git.repoUrl`.      |

**Outputs**

- `version-id` — The `04t` SubscriberPackageVersionId from the release tag annotation.
- `version-number` — Full version number (e.g. `0.4.0.1`).
- `version-base` — Major.minor.patch only (e.g. `0.4.0`).
- `tag` — The release tag name (e.g. `v0.4.0.1`).

---

## git/repo/info

Fetches and logs basic repository info from the GitHub API.

| Param          | Type   | Required | Description                                                        |
| -------------- | ------ | :------: | ------------------------------------------------------------------ |
| `github-alias` | string |          | GitHub token alias. Defaults to `default`.                         |
| `repo-url`     | string |          | GitHub repository URL. Falls back to `config.project.git.repoUrl`. |

---

## metadata/deploy

Deploys metadata to a target org using the Salesforce source deploy API.

| Param        | Type   | Required | Description                                                       |
| ------------ | ------ | :------: | ----------------------------------------------------------------- |
| `source-dir` | string |          | Path to the source directory to deploy. Defaults to `force-app`.  |
| `target-org` | string |          | Org alias or username. Defaults to the SF CLI default target-org. |

---

## org/assign/permsets

Assigns permission sets and/or permission set groups to a user.

| Param        | Type   | Required | Description                                                                                                             |
| ------------ | ------ | :------: | ----------------------------------------------------------------------------------------------------------------------- |
| `target-org` | string |          | Org alias or username. Defaults to the SF CLI default target-org.                                                       |
| `permsets`   | string |          | Comma-separated permission set or permission set group API names. Defaults to `project.package.permsets` in `ship.yml`. |
| `username`   | string |          | Username to assign to. Defaults to the org running user.                                                                |

---

## org/create/scratch

Creates a scratch org, or skips if a healthy one already exists under the same alias.

| Param          | Type    | Required | Description                                                                            |
| -------------- | ------- | :------: | -------------------------------------------------------------------------------------- |
| `scratch-def`  | string  |    ✓     | Scratch org def alias (resolved from `<shipDir>/orgs/`) or path to a `.json` def file. |
| `alias`        | string  |          | Override the org alias. Defaults to the def name prefixed by the project slug.         |
| `duration`     | number  |          | Duration in days. Defaults to 1.                                                       |
| `dev-hub`      | string  |          | Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.              |
| `set-default`  | boolean |          | Set as default org after creation. Defaults to `true`.                                 |
| `no-namespace` | boolean |          | Create the scratch org without the project namespace. Defaults to `false`.             |

**Outputs**

- `target-org` — The alias of the created (or existing) scratch org.
- `created` — `true` if a new scratch org was created; `false` if a healthy existing one was reused.

---

## org/delete/scratch

Deletes a scratch org by alias. Passthrough for `sf org delete scratch`.

| Param   | Type   | Required | Description                      |
| ------- | ------ | :------: | -------------------------------- |
| `alias` | string |    ✓     | The scratch org alias to delete. |

---

## package/create

Registers a 2GP managed or unlocked package on the Dev Hub and writes the `0Ho` into `sfdx-project.json`. Idempotent — skips if the package is already registered.

| Param                         | Type    | Required | Description                                                                       |
| ----------------------------- | ------- | :------: | --------------------------------------------------------------------------------- |
| `name`                        | string  |          | Display name for the package. Defaults to `project.package.name` from `ship.yml`. |
| `package-type`                | string  |    ✓     | Package type: `Managed` or `Unlocked`.                                            |
| `path`                        | string  |          | Path to the package source directory. Defaults to `force-app`.                    |
| `description`                 | string  |          | Description of the package.                                                       |
| `no-namespace`                | boolean |          | Create the package without a namespace.                                           |
| `target-dev-hub`              | string  |          | Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.         |
| `org-dependent`               | boolean |          | Mark as org-dependent. Only valid for Unlocked packages.                          |
| `error-notification-username` | string  |          | Username to receive package upload failure notifications.                         |

**Outputs**

- `package-id` — The `0Ho` Package2Id of the created (or already-registered) package.

---

## package/dependencies/lock

Resolves dependencies declared in `ship.yml` and writes them into `sfdx-project.json`. Commit the diff — it's your record of which dependency versions a release builds against.

No params. No outputs.

---

## package/dependencies/verify

Verifies that dependencies declared in `ship.yml` match what is committed in `sfdx-project.json`. Fails if they have drifted. Used by `release/beta` to guard against stale dependencies before a build.

No params. No outputs.

---

## package/install

Installs a package version into a Salesforce org. Passthrough for `sf package install`.

| Param        | Type   | Required | Description                                                       |
| ------------ | ------ | :------: | ----------------------------------------------------------------- |
| `version-id` | string |    ✓     | The `04t` package version ID to install.                          |
| `target-org` | string |          | Org alias or username. Defaults to the SF CLI default target-org. |
| `wait`       | number |          | Minutes to wait for installation to complete. Defaults to 10.     |

---

## package/install/dependencies

Resolves and installs all dependencies declared in `ship.yml` in topological order. Already-installed versions are skipped unless `force` is set.

| Param        | Type    | Required | Description                                                             |
| ------------ | ------- | :------: | ----------------------------------------------------------------------- |
| `target-org` | string  |          | Org alias or username. Defaults to the SF CLI default target-org.       |
| `wait`       | number  |          | Minutes to wait per package installation. Defaults to 10.               |
| `dry-run`    | boolean |          | Resolve and log dependency steps without installing.                    |
| `force`      | boolean |          | Reinstall package versions even if already installed in the target org. |

---

## package/version/create

Creates a managed package version. Passthrough for `sf package version create`. Waits for completion so the resulting version ID is available to subsequent steps.

| Param                     | Type    | Required | Description                                                                                          |
| ------------------------- | ------- | :------: | ---------------------------------------------------------------------------------------------------- |
| `package`                 | string  |          | Package ID (`0Ho`) or alias from `sfdx-project.json`. Defaults to the default package directory.     |
| `target-dev-hub`          | string  |          | Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.                            |
| `wait`                    | number  |          | Minutes to wait for the version create to complete. Defaults to 60.                                  |
| `code-coverage`           | boolean |          | Calculate and store Apex code coverage.                                                              |
| `skip-validation`         | boolean |          | Skip validation during version creation. Speeds up beta builds; not allowed for promotable versions. |
| `installation-key`        | string  |          | Installation key for key-protected package versions.                                                 |
| `installation-key-bypass` | boolean |          | Bypass the installation key requirement. Defaults to `true`.                                         |
| `version-number`          | string  |          | Override the version number (e.g. `1.2.0.NEXT`).                                                     |
| `version-name`            | string  |          | Human-readable version name.                                                                         |
| `branch`                  | string  |          | Branch name to associate with the package version.                                                   |
| `tag`                     | string  |          | Tag to associate with the package version.                                                           |
| `path`                    | string  |          | Path to the package directory. Defaults to the default package directory in `sfdx-project.json`.     |

**Outputs**

- `version-id` — The `04t` SubscriberPackageVersionId of the created version.
- `package-version-id` — The `05i` Package2VersionId (used by `package/version/promote`).
- `version-number` — The resolved version number (e.g. `0.2.0.1`).

---

## package/version/promote

Promotes a 2GP package version from beta to released. Passthrough for `sf package version promote`.

| Param            | Type    | Required | Description                                                               |
| ---------------- | ------- | :------: | ------------------------------------------------------------------------- |
| `version-id`     | string  |    ✓     | `04t` SubscriberPackageVersionId to promote.                              |
| `target-dev-hub` | string  |          | Dev hub alias or username. Defaults to the SF CLI default target-dev-hub. |
| `no-prompt`      | boolean |          | Skip the confirmation prompt. Defaults to `true`.                         |

**Outputs**

- `version-id` — The `04t` SubscriberPackageVersionId of the promoted version (unchanged from input).

---

## package/version/resolve-latest

Resolves the latest package version ID from the Dev Hub.

| Param            | Type    | Required | Description                                                                   |
| ---------------- | ------- | :------: | ----------------------------------------------------------------------------- |
| `package`        | string  |          | Package name, ID, or alias. Defaults to the project package from `ship.yml`.  |
| `target-dev-hub` | string  |          | Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.     |
| `released`       | boolean |          | When `true`, resolve the latest released version. Defaults to `false` (beta). |
| `branch`         | string  |          | Filter to versions built from a specific branch.                              |

**Outputs**

- `version-id` — The `04t` SubscriberPackageVersionId of the latest matching version.
- `version-number` — Full version number including build (e.g. `0.1.0.4`).
- `version-base` — Major.minor.patch only (e.g. `0.1.0`).

---

## package/version/resolve-next

Resolves the next package version number by reading the latest GitHub release, outputting a `.NEXT` version so Salesforce assigns the build slot automatically.

| Param          | Type   | Required | Description                                                                                    |
| -------------- | ------ | :------: | ---------------------------------------------------------------------------------------------- |
| `version-type` | string |          | Which part of the version to bump: `build`, `patch`, `minor`, or `major`. Defaults to `build`. |
| `repo-url`     | string |          | GitHub repository URL. Falls back to `config.project.git.repoUrl`.                             |

**Outputs**

- `version-number` — Next version number ending in `.NEXT`, ready to pass to `package/version/create`.

---

## project/deploy/start

Deploys metadata to a target org. Passthrough for `sf project deploy start`.

| Param              | Type    | Required | Description                                                                                                    |
| ------------------ | ------- | :------: | -------------------------------------------------------------------------------------------------------------- |
| `target-org`       | string  |          | Org alias or username. Defaults to the SF CLI default target-org.                                              |
| `source-dir`       | string  |          | Path to local source files to deploy. Defaults to `force-app`.                                                 |
| `manifest`         | string  |          | Full file path for a manifest (`package.xml`) of components to deploy.                                         |
| `metadata`         | string  |          | Metadata component names to deploy.                                                                            |
| `metadata-dir`     | string  |          | Root of a directory or zip file of metadata-formatted files to deploy.                                         |
| `ignore-conflicts` | boolean |          | Ignore conflicts and deploy local files even if they overwrite org changes.                                    |
| `ignore-warnings`  | boolean |          | Ignore warnings and allow a deployment to complete successfully.                                               |
| `dry-run`          | boolean |          | Validate deploy and run Apex tests but don't save to the org.                                                  |
| `test-level`       | string  |          | Apex testing level: `NoTestRun`, `RunSpecifiedTests`, `RunLocalTests`, `RunAllTestsInOrg`, `RunRelevantTests`. |
| `tests`            | string  |          | Apex tests to run when `test-level` is `RunSpecifiedTests`.                                                    |
| `wait`             | number  |          | Minutes to wait for the command to complete. Defaults to 33.                                                   |

---

## project/reset/tracking

Resets local and remote source tracking for an org. Passthrough for `sf project reset tracking`.

| Param        | Type    | Required | Description                                                           |
| ------------ | ------- | :------: | --------------------------------------------------------------------- |
| `target-org` | string  |          | Org alias or username. Defaults to the SF CLI default target-org.     |
| `revision`   | number  |          | SourceMember revision counter number to reset to. Defaults to latest. |
| `no-prompt`  | boolean |          | Skip the confirmation prompt. Defaults to `true`.                     |

---

## util/file/exists

Checks whether a file or directory exists. Outputs `exists` for use in step `if` gates.

| Param  | Type   | Required | Description                                                          |
| ------ | ------ | :------: | -------------------------------------------------------------------- |
| `path` | string |    ✓     | Path to check. Relative paths resolve against the project directory. |
| `kind` | string |          | What to check for: `any` (default), `file`, or `dir`.                |

**Outputs**

- `exists` — `true` if the path exists and matches `kind`; otherwise `false`.

---

## util/file/find

Finds files in a directory whose names match a glob pattern.

| Param             | Type    | Required | Description                                                                   |
| ----------------- | ------- | :------: | ----------------------------------------------------------------------------- |
| `path`            | string  |    ✓     | Directory to search, relative to the project root.                            |
| `pattern`         | string  |          | Glob pattern matched against the filename without extension. Defaults to `*`. |
| `recursive`       | boolean |          | Recurse into subdirectories. Defaults to `true`.                              |
| `strip-extension` | boolean |          | Strip file extensions from results. Defaults to `true`.                       |

**Outputs**

- `files` — Comma-separated list of matching file names.
- `count` — Number of matching files found.

---

## util/log

Logs a message to the flow output.

| Param     | Type   | Required | Description         |
| --------- | ------ | :------: | ------------------- |
| `message` | string |    ✓     | The message to log. |
