---
title: Ship Config
description: Complete reference for the ship.yml configuration file.
sidebar:
  order: 1
---

`ship.yml` tells the plugin what it's building, what it depends on, and where to publish it. It should be at the root of your project and committed to source-control.

## Top-level

| Key       | Type   | Required | Description                                                                                           |
| --------- | ------ | :------: | ----------------------------------------------------------------------------------------------------- |
| `project` | object |    ✓     | Project metadata. See [project](#project).                                                            |
| `dir`     | string |          | Directory used to resolve custom tasks, scratch org defs, and other ship assets. Defaults to `.ship`. |

## project

| Key       | Type   | Required | Description                                                                                                                                |
| --------- | ------ | :------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug`    | string |          | URL and alias-safe slug used as a prefix for generated org aliases. Defaults to `package.name` lowercased with spaces replaced by hyphens. |
| `package` | object |          | Salesforce package metadata. See [project.package](#projectpackage).                                                                       |
| `git`     | object |          | Git and GitHub configuration. See [project.git](#projectgit).                                                                              |

## project.package

| Key            | Type     | Required | Description                                                                                                          |
| -------------- | -------- | :------: | -------------------------------------------------------------------------------------------------------------------- |
| `name`         | string   |    ✓     | The package name as it appears in the Salesforce packaging UI.                                                       |
| `type`         | string   |    ✓     | Package type: `Managed` or `Unlocked`.                                                                               |
| `namespace`    | string   |          | The package namespace.                                                                                               |
| `permsets`     | string[] |          | Permission sets (and/or permission set groups) to assign to the running user after package install in flow contexts. |
| `testPattern`  | string   |          | Glob pattern used to discover Apex test classes. Defaults to `*_Test`.                                               |
| `dependencies` | object[] |          | Packages to install before deploying or packaging. See [Dependencies](#dependencies).                                |

## project.git

| Key             | Type   | Required | Description                               |
| --------------- | ------ | :------: | ----------------------------------------- |
| `defaultBranch` | string |          | The main branch name. Defaults to `main`. |
| `repoUrl`       | string |          | The GitHub repository URL.                |

## Dependencies

Each entry in `project.package.dependencies` is one of two forms.

**GitHub release** — resolves the package version ID from the annotated tag message of the latest (or pinned) release. Compatible with CumulusCI.

| Key      | Type   | Required | Description                                                                                                                         |
| -------- | ------ | :------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| `github` | string |    ✓     | Full GitHub repository URL (e.g. `https://github.com/org/repo`).                                                                    |
| `tag`    | string |          | Pin to a specific release tag instead of resolving to latest. Acts as a minimum version — the installer will reject anything older. |
| `name`   | string |          | Human-readable label used in log output and `sfdx-project.json` diffs.                                                              |

**Package version ID** — pins directly to a specific `04t` version.

| Key         | Type   | Required | Description                                                            |
| ----------- | ------ | :------: | ---------------------------------------------------------------------- |
| `versionId` | string |    ✓     | The `04t` SubscriberPackageVersionId.                                  |
| `name`      | string |          | Human-readable label used in log output and `sfdx-project.json` diffs. |

## Full Example

```yaml title="ship.yml"
dir: .ship

project:
  slug: my-package
  package:
    name: My Package
    type: Managed
    namespace: mypkg
    permsets:
      - MyPackage_Admin
      - MyPackage_User
    testPattern: '*_Test'
    dependencies:
      - github: https://github.com/SalesforceFoundation/NPSP
        name: NPSP
      - github: https://github.com/sfship/some-package
        tag: v1.2.0
        name: Some Package
      - versionId: 04t6g000008Sl8uAAC
        name: Another Package
  git:
    defaultBranch: main
    repoUrl: https://github.com/my-org/my-package
```
