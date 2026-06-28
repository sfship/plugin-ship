---
title: Flows
description: Define your own orchestration flows in YAML to compose built-in and custom tasks.
sidebar:
  order: 1
---

Flows are YAML files placed in `.ship/flows/`. They are invoked by name with `sf ship flow run <name>` and can compose any combination of built-in and [custom tasks](/plugin-ship/extending/tasks/).

## Shadowing Built-in Flows

If a flow in `.ship/flows/` has the same path as a built-in flow, it takes precedence. This lets you override built-in behavior for your project.

For example, creating `.ship/flows/deploy/dev.yml` will replace the built-in `deploy/dev` flow entirely. You can use this to add steps, change parameters, or swap out tasks while keeping the same flow name.

Use `sf ship flow eject` to copy a built-in flow into your project as a starting point:

```sh
sf ship flow eject deploy/dev
```

This copies the built-in flow to `.ship/flows/deploy/dev.yml`, which immediately shadows the original.

## Flow Structure

```yaml
description: A brief description of what this flow does.
params:
  - name: my-param
    type: string
    required: false
    description: A param passed in at runtime.
steps:
  step-one:
    task: util/log
    params:
      message: Hello from step one.
  step-two:
    task: util/log
    params:
      message: ${{ params.my-param }}
```

## Params

Params declared under `params` are passed at runtime with `--param key=value`. Each param definition supports:

| Field         | Required | Description                                                          |
| ------------- | :------: | -------------------------------------------------------------------- |
| `name`        |    ✓     | The param name, in kebab-case.                                       |
| `type`        |          | `string`, `number`, or `boolean`. Defaults to `string`.              |
| `required`    |          | Whether the flow fails if the param is missing. Defaults to `false`. |
| `default`     |          | Default value when the param is not provided.                        |
| `description` |          | Description shown in `sf ship flow list`.                            |

## Expressions

Use `${{ }}` to reference dynamic values anywhere in a step's `params`:

| Expression                        | Description                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `${{ params.<name> }}`            | A param passed to the flow at runtime.                                                                         |
| `${{ steps.<step-id>.<output> }}` | An output from a previous step. See the [Task Reference](/plugin-ship/reference/tasks/) for available outputs. |
| `${{ config.project.<field> }}`   | A value from `ship.yml`, e.g. `config.project.package.namespace`.                                              |

## Conditional Steps

Steps can be skipped at runtime using `if` or `if-not`. Both take a `value` expression and an optional `equals` comparison. When `equals` is omitted, the condition checks for truthiness.

```yaml
steps:
  check-file:
    task: util/file/exists
    params:
      path: unpackaged/post
  deploy-post:
    if:
      value: ${{ steps.check-file.exists }}
    task: project/deploy/start
    params:
      source-dir: unpackaged/post
  managed-only:
    if-not:
      value: ${{ config.project.package.type }}
      equals: Unlocked
    task: util/log
    params:
      message: Running because this is not an Unlocked package.
```

A step cannot have both `if` and `if-not`.

## Ignoring Failures

By default, any step failure stops the flow. Set `ignore-failure: true` on a step to continue regardless:

```yaml
steps:
  risky-step:
    task: util/log
    params:
      message: This might fail.
    ignore-failure: true
```

## Finally Steps

Steps declared under `finally` always run after `steps` complete — whether the flow succeeded or failed. Useful for cleanup:

```yaml
steps:
  do-work:
    task: util/log
    params:
      message: Doing work.
finally:
  cleanup:
    task: org/delete/scratch
    params:
      alias: my-temp-org
```

Step IDs must be unique across `steps` and `finally`.
