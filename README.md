# plugin-ship

[![NPM](https://img.shields.io/npm/v/plugin-ship.svg?label=plugin-ship)](https://www.npmjs.com/package/plugin-ship) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://raw.githubusercontent.com/sfship/plugin-ship/main/LICENSE)

A Salesforce CLI plugin for managing the full development and release lifecycle of second-generation managed and unlocked packages.

Flows and tasks are defined in a `ship.yml` config file. Flows are sequences of tasks that can pass data between steps. Tasks can also be run individually outside of a flow.

## Install

```bash
sf plugins install plugin-ship
```

## Setup

Connect your GitHub account before using tasks that interact with GitHub:

```bash
sf ship service connect github
```

## Commands

- [`sf ship flow list`](#sf-ship-flow-list)
- [`sf ship flow info <name>`](#sf-ship-flow-info)
- [`sf ship flow run <name>`](#sf-ship-flow-run)
- [`sf ship task list`](#sf-ship-task-list)
- [`sf ship task info <name>`](#sf-ship-task-info)
- [`sf ship task run <name>`](#sf-ship-task-run)
- [`sf ship service connect github`](#sf-ship-service-connect-github)

---

### `sf ship flow list`

Lists all flows defined in `ship.yml`.

```
USAGE
  $ sf ship flow list [--config <value>]

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
```

### `sf ship flow info`

Shows description, params, and steps for a flow.

```
USAGE
  $ sf ship flow info <name> [--config <value>]

ARGUMENTS
  NAME  Name of the flow.

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
```

### `sf ship flow run`

Runs a named flow defined in `ship.yml`.

```
USAGE
  $ sf ship flow run <name> [--config <value>] [--param <value>...]

ARGUMENTS
  NAME  Name of the flow to run.

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
  --param=<value>   Flow param in key=value format. May be specified multiple times.

EXAMPLES
  $ sf ship flow run release --param version=1.2.0
```

### `sf ship task list`

Lists all available tasks — built-in and any custom tasks in `.ship/actions/`.

```
USAGE
  $ sf ship task list [--config <value>]

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
```

### `sf ship task info`

Shows description and param schema for a task.

```
USAGE
  $ sf ship task info <name> [--config <value>]

ARGUMENTS
  NAME  Name of the task.

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
```

### `sf ship task run`

Runs a single task directly, outside of a flow.

```
USAGE
  $ sf ship task run <name> [--config <value>] [--param <value>...]

ARGUMENTS
  NAME  Name of the task to run.

FLAGS
  --config=<value>  [default: ship.yml] Path to the ship config file.
  --param=<value>   Task param in key=value format. May be specified multiple times.

EXAMPLES
  $ sf ship task run deploy-metadata --param targetOrg=myOrg
```

### `sf ship service connect github`

Connects a GitHub account via OAuth device flow.

```
USAGE
  $ sf ship service connect github [--alias <value>]

FLAGS
  --alias=<value>  [default: default] Alias to store the connection under.
```

## Local Development

```bash
# Install dependencies and compile
yarn && yarn build

# Link to the SF CLI for local testing
sf plugins link .
```

### Commit Types

When making a commit, the format `{type}: my lowercase message` is enforced.

| Type       | Description                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New feature                                    |
| `fix`      | Bug fix                                        |
| `chore`    | Maintenance (deps, config, tooling)            |
| `refactor` | Code change that's neither a fix nor a feature |
| `test`     | Adding or updating tests                       |
| `docs`     | Documentation only                             |
| `ci`       | CI/CD config changes                           |
| `build`    | Changes to the build system                    |
| `perf`     | Performance improvement                        |
| `style`    | Formatting, whitespace (no logic change)       |
