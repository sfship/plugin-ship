---
title: Release
description: Validate, release, and promote a package version.
sidebar:
  order: 4
---

The exact order and method of flow execution will depend on your own development processes. Below is one possible development lifecycle.

:::tip
SF Ship uses GitHub release tags to track package versions and auto-generate release notes from merged pull requests. For accurate release notes, merge all changes to your default branch before running `release/beta` — the plugin doesn't enforce this, but release notes will be incomplete if PRs are still open at release time.
:::

## Feature Testing

The `deploy/feature` flow builds a package version from your current commit, installs it into a fresh scratch org, and runs your Apex tests against it.

```bash
sf ship flow run deploy/feature
```

You can skip the build and install a specific version instead:

```bash
sf ship flow run deploy/feature --param version-id=04t...
```

This is a fast iteration loop for development — validation is skipped and code coverage is not enforced, so the resulting version is **not promotable**. When you're ready to publish, use `release/beta` instead.

## Release Beta

The `release/beta` flow creates a validated, promotable package version and publishes it as a GitHub prerelease. Unlike `deploy/feature`, code coverage is enforced and validation runs in full.

```bash
sf ship flow run release/beta
```

By default, this bumps the **minor** version relative to the latest production release. Pass `--param version-type` to control which part is bumped:

```bash
sf ship flow run release/beta --param version-type=patch
```

| `version-type` | Description                                              |
| -------------- | -------------------------------------------------------- |
| `build`        | Bumps the build number only (e.g. `1.2.0.1 → 1.2.0.2`)   |
| `patch`        | Bumps the patch (e.g. `1.2.0 → 1.2.1`)                   |
| `minor`        | Bumps the minor version (e.g. `1.2.0 → 1.3.0`) — default |
| `major`        | Bumps the major version (e.g. `1.2.0 → 2.0.0`)           |

:::note
`release/beta` runs `package/dependencies/verify` as its first step. If your declared dependencies in `ship.yml` have drifted from `sfdx-project.json`, the flow will fail. Run [`dependencies/lock`](/plugin-ship/package-development/managing-dependencies/) and commit the diff first.
:::

## Regression Testing

The `deploy/regression` flow simulates a customer upgrade — it installs the current production release into a fresh scratch org, then upgrades it to the latest beta. Use this to catch upgrade-specific issues before promoting.

```bash
sf ship flow run deploy/regression
```

## Promote to Production

The `release/production` flow promotes the latest beta to released status and publishes it as a production GitHub release.

```bash
sf ship flow run release/production
```

:::caution
Salesforce can take a few minutes to propagate a freshly promoted version. If the flow fails with "no corresponding Package Version Id", wait a moment and retry.
:::
