---
title: Managing Dependencies
description: Declare package dependencies in ship.yml and lock them into sfdx-project.json for validated package version builds.
sidebar:
  order: 3
---

Dependencies are declared in `ship.yml` and locked into `sfdx-project.json` before building a package version. If declared, SF Ship will install dependencies into scratch orgs and declare them during package releases.

## Declaring Dependencies

Dependencies live under `project.package.dependencies` in `ship.yml`. Two forms are supported.

### GitHub Release

If the dependent package is another SF Ship or [CumulusCI](https://cumulusci.readthedocs.io/en/stable/) project, this is the recommended approach.

The package version ID will be resolved from the annotated tag message of the latest release.

#### SF Ship Dependency

```yaml title="ship.yml"
project:
  package:
    dependencies:
      - github: https://github.com/bdematt/mock-ship-dependency
        tag: v0.4.0 # Optionally pin a minimum version
        name: Tutorial Dependent Package
      - github: https://github.com/SalesforceFoundation/NPSP
        name: NPSP
```

#### CumulusCI Dependency

SF Ship is backwards compatible with CumulusCI (CCI) packages, such as NPSP.

```yaml title="ship.yml"
project:
  package:
    dependencies:
      # NPSP is a CumulusCI package
      - github: https://github.com/SalesforceFoundation/NPSP
        name: NPSP
```

### Package Version ID

For any other managed package, declare it by specifying its `04t` version ID:

```yaml title="ship.yml"
project:
  package:
    dependencies:
      - versionId: 04t6g000008Sl8uAAC
        name: Tutorial Dependent Package
```

`name` is optional in both forms but recommended — it labels the dependency in log output and produces a readable diff when locking.

## Locking Dependencies

The `dependencies/lock` flow resolves your declared dependencies and writes them into `sfdx-project.json` so a validated `package version create` can compile against them.

Run this command before the initial release of a project with dependencies.

If you have GitHub release dependencies which are not version-pinned, you will be prompted to rerun this command before re-releasing if your dependent package has published a release since your previous one. This is to prevent inadvertently bumping the dependent package's minimum version.

```bash
sf ship flow run dependencies/lock
```

This updates the `packageAliases` and `dependencies` fields in `sfdx-project.json`. This should be tracked in source control. It's your record of which dependency versions a release builds against.

```json title="Example sfdx-project.json Output"
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "Tutorial Package",
      "versionName": "ver 0.1",
      "versionNumber": "0.0.0.NEXT",
      "dependencies": [
        {
          "package": "Tutorial Dependency"
        }
      ]
    }
  ],
  "name": "Mock-Ship-Project",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "66.0",
  "defaultLwcLanguage": "typescript",
  "packageAliases": {
    "Tutorial Package": "0HoWU0000002WGj0AM",
    "Tutorial Dependency": "04tWU000000SuvJYAS"
  }
}
```
