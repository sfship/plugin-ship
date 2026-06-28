---
title: Deploy Dev Scratch Org
description: Create a scratch org development environment and deploy your package source.
sidebar:
  order: 2
---

## Create a Dev Scratch Org

The `deploy/dev` flow sets up a scratch org as a development environment. It creates the org, [installs dependencies](./dependencies/), deploys your source, assigns permission sets, and imports data.

```bash
sf ship flow run deploy/dev
```

## Open Your Scratch Org

The `deploy/dev` follows the alias naming convention `{project-name}:{environment}`, so `tutorial-package:dev` in this example. Normally, it should be set as the default scratch org, so it can be opened using the following command:

```bash
sf org open
```

## Capture Metadata Changes

After making changes in your developer scratch org, retrieve them using [`sf project retrieve start`](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_retrieve_start.html)

```bash
sf project retrieve start
```
