---
title: Tasks
description: Write your own tasks as JavaScript modules to extend SF Ship with custom logic.
sidebar:
  order: 2
---

Custom tasks are ESM JavaScript files placed in `.ship/tasks/`. They are referenced in flows by their path relative to that directory — a file at `.ship/tasks/my-org/setup.mjs` is referenced as `task: my-org/setup`.

## Task Structure

A task is a file that exports a default object with a `description`, optional `params` and `outputs` declarations, and a `run` function:

```js title=".ship/tasks/my-org/setup.mjs"
export default {
  description: 'Sets up the org with custom configuration.',
  params: [
    { name: 'target-org', type: 'string', required: true, description: 'Org alias to configure.' },
    { name: 'enable-feature', type: 'boolean', required: false, default: false },
  ],
  outputs: [{ name: 'status', type: 'string', description: 'Result of the setup.' }],
  async run({ params, flow, output }) {
    flow.log(`Configuring org: ${params['target-org']}`);
    // ... your logic here
    output.set('status', 'done');
  },
};
```

## Params

Params follow the same definition schema as flow params:

| Field         | Required | Description                                                       |
| ------------- | :------: | ----------------------------------------------------------------- |
| `name`        |    ✓     | The param name, in kebab-case.                                    |
| `type`        |          | `string`, `number`, `boolean`, or `record`. Defaults to `string`. |
| `required`    |          | Whether the task fails if the param is missing.                   |
| `default`     |          | Default value when the param is not provided.                     |
| `description` |          | Description shown in `sf ship task list`.                         |

Param values are accessed in `run` via `params['param-name']`.

## The `flow` Context

The `flow` object provides access to the broader execution environment:

| Property                    | Description                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `flow.log(msg)`             | Writes a timestamped message to the flow output.                                           |
| `flow.config`               | The loaded `ship.yml` configuration. See the [ship.yml reference](../reference/ship-yml/). |
| `flow.projectDir`           | Absolute path to the project root (where `ship.yml` lives).                                |
| `flow.shipDir`              | Absolute path to the `.ship` directory.                                                    |
| `flow.runCommand(id, argv)` | Invokes an SF CLI command in-process (e.g. `sf org list`).                                 |
| `flow.hasFailures`          | `true` if any previous step failed with `ignore-failure: true`.                            |

## Outputs

Use `output.set(name, value)` to write values that subsequent steps can reference via `${{ steps.<step-id>.<name> }}`. Declare outputs in the `outputs` array so they appear in the task reference:

```js
outputs: [
  { name: 'org-alias', type: 'string', description: 'The alias of the configured org.' },
],
async run({ output }) {
  output.set('org-alias', 'my-org');
},
```

## Using npm Packages

Because custom tasks are standard ESM modules, they can import any npm package installed in your project. Install a dependency as normal and import it directly in your task file:

```js title=".ship/tasks/util/check-odd.mjs"
import isOdd from 'is-odd';

export default {
  description: 'Determines if a given number is odd.',
  params: [{ name: 'number', type: 'number', required: true }],
  outputs: [{ name: 'is-odd', type: 'boolean', description: 'Whether the number is odd.' }],
  async run({ flow, params, output }) {
    const n = params['number'];
    const result = isOdd(n);
    output.set('is-odd', result);
    flow.log(`${n} ${result ? 'is' : 'is not'} odd.`);
  },
};
```

This applies to any package on npm — HTTP clients, file parsers, Salesforce SDKs, or anything else your automation needs.

## Shadowing Built-in Tasks

Like flows, a custom task at `.ship/tasks/org/create/scratch.mjs` will shadow the built-in `org/create/scratch` task. This lets you replace any built-in task's behavior for your project.
