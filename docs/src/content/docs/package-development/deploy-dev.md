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

Rerunning `deploy/dev` against an existing org deploys only the package source you've changed locally since the last deploy, using Salesforce source tracking. Changes made directly in the org are left alone unless you've also changed the same component locally. That's a conflict, and the deploy stops. Retrieve anything from the org you want to keep, then rerun with `--param ignore-conflicts=true` to overwrite the org with your local source.

[Unpackaged metadata](/plugin-ship/package-development/unpackaged-metadata/) sits outside source tracking, so `unpackaged/pre` and `unpackaged/post` deploy in full on every run and overwrite their components in the org.

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
