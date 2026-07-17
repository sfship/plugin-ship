---
title: Deploy Dev Scratch Org
description: Create a scratch org development environment and deploy your package source.
sidebar:
  order: 2
---

## Create a Dev Scratch Org

The `deploy/dev` flow sets up a scratch org as a development environment. It creates the org, [installs dependencies](/plugin-ship/package-development/managing-dependencies/), deploys your source, assigns permission sets, and imports data.

```bash
sf ship flow run deploy/dev
```

The org carries your package namespace. Contributors without access to the namespace-linked Dev Hub can pass `--param no-namespace=true` — see [Unnamespaced Development](/plugin-ship/package-development/unnamespaced-development/).

## Open Your Scratch Org

The scratch org created by `deploy/dev` follows the alias naming convention `{project-name}:{environment}` — `tutorial-package:dev` in this example. It's normally set as the default org, so you can open it with:

```bash
sf org open
```

## Capture Metadata Changes

After making changes in your developer scratch org, retrieve them using [`sf project retrieve start`](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_retrieve_start.html)

```bash
sf project retrieve start
```
