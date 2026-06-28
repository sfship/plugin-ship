---
title: Getting Started
description: Install the plugin and connect your GitHub account.
---

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) installed and configured
- [Salesforce Extensions for VS Code](https://developer.salesforce.com/tools/vscode) (recommended)

:::note
This plugin leans heavily on the standard sf cli commands, some of whose commands will appear throughout the documentation. See [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html) for a complete reference.
:::

## Install

:::caution
This plugin is in beta. Don't use it in production.
:::

```bash
sf plugins install @sfship/plugin-ship@beta
```

## Connect GitHub

Links your GitHub account so ship can create releases, open pull requests, and read repository metadata.

```bash
sf ship service connect github
```

## Initialize Project

Initializes a Salesforce project with `.ship/` directory and `ship.yml` configuration file.

```bash
sf ship project init
```

## Verify Installation

```bash
sf ship flow list
```

If installed correctly, you should see the following built-in flows available:

```text title="Output"
=== Flow List

├── create/
│   └── package
├── dependencies/
│   └── lock
├── deploy/
│   ├── beta
│   ├── dev
│   ├── feature
│   ├── qa
│   ├── regression
│   └── release
├── release/
│   ├── beta
│   └── production
```

:::note
After initializing, restart VS Code so the Salesforce extensions recognize the project.
:::
