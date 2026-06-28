---
title: Register Package
description: Register your 2GP package on the Dev Hub and write its ID into sfdx-project.json.
sidebar:
  order: 1
---

:::tip
Ensure you have a default Dev Hub set before running flows that create scratch orgs.

```bash
sf org login web --set-default-dev-hub
```

:::

## Register Your Package

Run this once per project to register the 2GP package on the Dev Hub and write its ID into `sfdx-project.json`. This should be tracked in git.

```bash
sf ship flow run create/package
```

Your `sfdx-project.json` should have been modified to include `packageAliases`

```json title="Example sfdx-project.json Output"
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "tutorial-package",
      "versionName": "ver 0.1",
      "versionNumber": "0.0.0.NEXT"
    }
  ],
  "name": "tutorial-project",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "67.0",
  "packageAliases": {
    "tutorial-package": "0HoWU000000xxxxxxx"
  }
}
```
