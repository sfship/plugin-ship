---
title: Flows
description: Reference for all built-in flows.
sidebar:
  order: 2
---

## create/package

Register the 2GP package on the Dev Hub and write its ID into `sfdx-project.json`. Run once per project before any release or `deploy/feature` flow.

```yaml
description: Register the 2GP package on the Dev Hub and write its 0Ho into sfdx-project.json. Run once per project before any release or deploy/feature flow.
params:
  - name: path
    type: string
    required: false
    default: force-app
    description: Path to the package source directory.
  - name: target-dev-hub
    type: string
    required: false
    description: Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.
steps:
  create-package:
    task: package/create
    params:
      package-type: ${{ config.project.package.type }}
      path: ${{ params.path }}
      target-dev-hub: ${{ params.target-dev-hub }}
```

---

## dependencies/lock

Resolve `ship.yml` dependencies into `sfdx-project.json`. Run whenever your dependencies change and commit the diff before cutting a release.

```yaml
description: Resolve ship.yml dependencies into sfdx-project.json. Run whenever your dependencies change, then commit the diff before cutting a release.
steps:
  lock:
    task: package/dependencies/lock
```

---

## deploy/beta

Install the latest beta package into a fresh scratch org and run Apex tests.

```yaml
description: Install the latest beta into a fresh scratch org and run Apex tests.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: beta
      duration: 1
      no-namespace: true
  find-beta:
    task: git/release/fetch
    params:
      prerelease: true
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  install:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.find-beta.version-id }}
  assign-permsets:
    task: org/assign/permsets
    params:
      target-org: ${{ steps.create-org.target-org }}
  find-test-classes:
    task: util/file/find
    params:
      path: force-app/main/default/classes
      pattern: ${{ config.project.package.testPattern }}
  run-tests:
    if:
      value: ${{ steps.find-test-classes.count }}
    task: apex/run/test
    params:
      target-org: ${{ steps.create-org.target-org }}
      class-names: ${{ steps.find-test-classes.files }}
      namespace: ${{ config.project.package.namespace }}
```

---

## deploy/dev

Set up a scratch org as a development environment — creates the org, installs dependencies, deploys source, assigns permission sets, and imports data.

```yaml
description: Set up a scratch org as a development environment for unmanaged metadata.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: dev
      duration: 30
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  deploy:
    task: project/deploy/start
    params:
      target-org: ${{ steps.create-org.target-org }}
  assign-permsets:
    task: org/assign/permsets
    params:
      target-org: ${{ steps.create-org.target-org }}
  load-data:
    task: data/import/tree
    if:
      value: ${{ steps.create-org.created }}
      equals: true
    params:
      target-org: ${{ steps.create-org.target-org }}
```

---

## deploy/feature

Build a managed package version from the current commit, install it into a fresh scratch org, and run Apex tests.

```yaml
description: Build a managed package version, install it, and run Apex tests against a fresh scratch org.
params:
  - name: version-id
    type: string
    required: false
    description: Existing 04t SubscriberPackageVersionId to install. If omitted, a new package version is built from the current commit.
  - name: version-type
    type: string
    required: false
    default: build
    description: Which part of the version to bump relative to the latest released version. One of build, patch, minor, major.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: feature
      duration: 1
      no-namespace: true
  resolve-next:
    if-not:
      value: ${{ params.version-id }}
    task: package/version/resolve-next
    params:
      version-type: ${{ params.version-type }}
  create-version:
    if-not:
      value: ${{ params.version-id }}
    task: package/version/create
    params:
      code-coverage: false
      skip-validation: true
      version-number: ${{ steps.resolve-next.version-number }}
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  install:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.create-version.version-id }}${{ params.version-id }}
  find-test-classes:
    task: util/file/find
    params:
      path: force-app/main/default/classes
      pattern: ${{ config.project.package.testPattern }}
  run-tests:
    if:
      value: ${{ steps.find-test-classes.count }}
    task: apex/run/test
    params:
      target-org: ${{ steps.create-org.target-org }}
      class-names: ${{ steps.find-test-classes.files }}
      namespace: ${{ config.project.package.namespace }}
```

---

## deploy/qa

Set up a QA environment using the latest beta, with unpackaged pre/post metadata and sample data.

```yaml
description: Set up a QA environment using the latest beta managed package.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: qa
      duration: 7
      no-namespace: true
  package-data:
    task: git/release/fetch
    params:
      prerelease: true
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  check-pre:
    task: util/file/exists
    params:
      path: unpackaged/pre
  deploy-pre:
    if:
      value: ${{ steps.check-pre.exists }}
    task: project/deploy/start
    params:
      target-org: ${{ steps.create-org.target-org }}
      source-dir: unpackaged/pre
  install:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.package-data.version-id }}
  check-post:
    task: util/file/exists
    params:
      path: unpackaged/post
  deploy-post:
    if:
      value: ${{ steps.check-post.exists }}
    task: project/deploy/start
    params:
      target-org: ${{ steps.create-org.target-org }}
      source-dir: unpackaged/post
  assign-permsets:
    task: org/assign/permsets
    params:
      target-org: ${{ steps.create-org.target-org }}
  load-data:
    task: data/import/tree
    params:
      target-org: ${{ steps.create-org.target-org }}
```

---

## deploy/regression

Simulate an upgrade from the latest production release to the latest beta, with full dependency and unpackaged metadata setup.

```yaml
description: Simulate an upgrade from the latest production release to the latest beta, with full dependency and unpackaged metadata setup.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: regression
      duration: 1
      no-namespace: true
  find-release:
    task: git/release/fetch
    params:
      prerelease: false
  find-beta:
    task: git/release/fetch
    params:
      prerelease: true
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  check-pre:
    task: util/file/exists
    params:
      path: unpackaged/pre
  deploy-pre:
    if:
      value: ${{ steps.check-pre.exists }}
    task: project/deploy/start
    params:
      target-org: ${{ steps.create-org.target-org }}
      source-dir: unpackaged/pre
  install-release:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.find-release.version-id }}
  install-beta:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.find-beta.version-id }}
  assign-permsets:
    task: org/assign/permsets
    params:
      target-org: ${{ steps.create-org.target-org }}
  check-post:
    task: util/file/exists
    params:
      path: unpackaged/post
  deploy-post:
    if:
      value: ${{ steps.check-post.exists }}
    task: project/deploy/start
    params:
      target-org: ${{ steps.create-org.target-org }}
      source-dir: unpackaged/post
  load-data:
    task: data/import/tree
    params:
      target-org: ${{ steps.create-org.target-org }}
```

---

## deploy/release

Install the latest production release into a fresh scratch org and run Apex tests.

```yaml
description: Install the latest production release into a fresh scratch org and run Apex tests.
steps:
  create-org:
    task: org/create/scratch
    params:
      scratch-def: release
      duration: 1
      no-namespace: true
  find-release:
    task: git/release/fetch
    params:
      prerelease: false
  update-dependencies:
    task: package/install/dependencies
    params:
      target-org: ${{ steps.create-org.target-org }}
  install:
    task: package/install
    params:
      target-org: ${{ steps.create-org.target-org }}
      version-id: ${{ steps.find-release.version-id }}
  assign-permsets:
    task: org/assign/permsets
    params:
      target-org: ${{ steps.create-org.target-org }}
  find-test-classes:
    task: util/file/find
    params:
      path: force-app/main/default/classes
      pattern: ${{ config.project.package.testPattern }}
  run-tests:
    if:
      value: ${{ steps.find-test-classes.count }}
    task: apex/run/test
    params:
      target-org: ${{ steps.create-org.target-org }}
      class-names: ${{ steps.find-test-classes.files }}
      namespace: ${{ config.project.package.namespace }}
```

---

## release/beta

Build a validated beta managed package version and publish it as a GitHub prerelease.

```yaml
description: Build a beta managed package version and release it on GitHub.
params:
  - name: version-type
    type: string
    required: false
    default: minor
    description: Which part of the version to bump relative to the latest released version. One of build, patch, minor, major.
steps:
  verify-dependencies:
    task: package/dependencies/verify
  resolve-next:
    task: package/version/resolve-next
    params:
      version-type: ${{ params.version-type }}
  create-version:
    task: package/version/create
    params:
      code-coverage: true
      version-number: ${{ steps.resolve-next.version-number }}
  github-release:
    task: git/release/create
    params:
      tag: v${{ steps.create-version.version-number }}
      version-id: ${{ steps.create-version.version-id }}
      prerelease: true
```

---

## release/production

Promote the latest beta to a released package version and publish it as a GitHub release.

```yaml
description: Promote the latest beta to released and create a production GitHub release.
steps:
  find-beta:
    task: git/release/fetch
    params:
      prerelease: true
  promote:
    task: package/version/promote
    params:
      version-id: ${{ steps.find-beta.version-id }}
  github-release:
    task: git/release/create
    params:
      tag: v${{ steps.find-beta.version-base }}
      version-id: ${{ steps.promote.version-id }}
      prerelease: false
```
