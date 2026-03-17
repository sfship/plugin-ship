# summary

Run a single ship action.

# description

Runs a built-in or custom action directly, outside of a flow. Useful for testing and one-off operations.

# args.actionName.summary

The name of the action to run.

# flags.config.summary

Path to the ship.yml config file.

# flags.param.summary

Action parameter in key=value format.

# examples

- Run the log action:

  <%= config.bin %> <%= command.id %> log --param message=hello

- Run a custom action:

  <%= config.bin %> <%= command.id %> create-scratch-org --param scratch-def=dev
