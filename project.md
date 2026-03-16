# Ship Plugin — Design Summary

## Overview

`@sfship/plugin-ship` is a Salesforce CLI plugin for managing the full development and
release lifecycle of second-generation managed and unlocked packages. It targets ISV
developers and Salesforce partners who need orchestration above what `plugin-packaging` provides natively.

## Distribution

- Distributed as a Salesforce CLI plugin via npm under the `@sfship` scope
- Installed via `sf plugins install @sfship/plugin-ship`
- TypeScript internally, plain JS supported for custom actions
- Commands are accessible under the `sf ship` namespace

## Config File

A YAML config file (`ship.yml`) in the project root is the source of truth for the
project. It defines the project name, dependencies, scratch org configurations, and
post-create hooks.

```yaml
project:
  name: myproject
  namespace: mynamespace

dependencies:
  - id: 04t000000000001 # Salesforce Industries Foundation
  - id: 04t000000000002 # Some other managed package
  - id: 04t000000000003 # Your own dependency package

scratch_orgs:
  dev:
    definition: config/dev-scratch-def.json
    post_create:
      - action: assign_permset
        name: MyPermSet
      - action: run_apex
        file: scripts/setup.apex
      - action: ./actions/my-custom-action.js
        some_param: some_value
  beta:
    definition: config/beta-scratch-def.json
  qa:
    definition: config/qa-scratch-def.json
```

## Scratch Org Management

- Scratch org definitions are declared in `ship.yml` under `scratch_orgs`
- Orgs are created using SF CLI's native auth and alias system
- Aliases are automatically derived as `project-name:scratch-def-name` (e.g.
  `myproject:dev`) to avoid collisions across projects
- No parallel auth system — Ship defers entirely to SF CLI's org management

Example commands:

```bash
sf ship org create dev
sf ship org create beta
```

## Dependency Management

- Dependencies are declared explicitly as 04t IDs in `ship.yml`
- No dynamic dependency resolution — the developer owns the explicit list
- Install order follows declaration order
- Ship chains `sf package install` calls in sequence during org setup
- A first-party `sf ship dependency update` command is provided to help developers
  update a dependency's 04t ID in the config file
- TODO: Do we need dependency resolution via Github a la Cumulusci?

## Namespace Token Injection

- Supports replacement of namespace tokens (e.g. `%%%NAMESPACE%%%`) in metadata
  at deploy time
- Namespace is declared under `project.namespace` in `ship.yml`
- Ship provides an `sf ship deploy` command that sets the namespace context
  automatically before delegating to SF CLI's native string replacement feature
- Injection is handled programmatically, cross-platform safe
- TODO: Can we just use SF CLI's native string replacement feature, configured in `sfdx-project.json`

## Unpackaged Metadata

- Pre- and post-install unpackaged metadata directories are declared in `ship.yml`
- Deployed via SF CLI's deploy APIs in the correct sequence relative to package
  installs

## Release Management

- Promotes a package version using SF CLI's native `sf package version promote`
- Creates a corresponding GitHub release with generated release notes
- GitHub auth uses the user's existing GitHub CLI token or a configured token TODO: Will this work?

Example command:

```bash
sf ship release
```

## Actions System

Actions are the extensibility primitive for any task performed by the plugin. They are invoked by the flow runner and context is passed in.

### Built-in Actions

A library of first-party actions ships with the plugin covering common Salesforce
setup operations:

- `assign_permset` — assigns a permission set to the org user, idempotent
- `run_apex` — executes an anonymous Apex file
- `deploy_metadata` — deploys a metadata directory
- `install_package` — installs a package version by 04t ID

### Custom Actions

Users can provide their own actions as plain JS files referenced by path in `ship.yml`.
Custom actions export a default async function and receive a context object and params:

```javascript
// @ts-check
import { defineAction } from '@sfship/plugin-ship';

export default defineAction(async ({ connection, query, create, log }, params) => {
  // implement custom action
});
```

The `defineAction` wrapper is a no-op at runtime that exists purely to provide
TypeScript type inference and IDE hints in plain JS files. Users get full autocomplete
on the context object without writing TypeScript.

### Action Context

The context object passed to every action exposes:

- `connection` — raw `@salesforce/core` Connection object for advanced use
- `query(soql)` — convenience wrapper for SOQL queries
- `create(sobject, record)` — convenience wrapper for record creation
- `log(message)` — logger bound to the plugin's output system

## What Ship Does Not Do (as of MVP)

- No Robot Framework or browser test automation
- No MetaDeploy plan publishing
- No Git branch management or auto-merging
- No parallel auth system or org keychain
- No built-in CI system — Ship is CI-agnostic and works in any pipeline
