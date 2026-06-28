---
title: Feature Testing
description: Salesforce CLI plugin for the full package development and release lifecycle.
sidebar:
  order: 4
---

## Feature Testing

The `deploy/feature` flow builds a managed package version from your current commit, installs it into a fresh scratch org, and runs your Apex tests against it.

```bash
sf ship flow run deploy/feature
```

You can skip the build and install a specific version instead:

```bash
sf ship flow run deploy/feature --param version-id=04t...
```
