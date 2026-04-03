# summary

Run a single ship task.

# description

Runs a built-in or custom task directly, outside of a flow. Useful for testing and one-off operations.

# args.taskName.summary

The name of the task to run.

# flags.config.summary

Path to the ship.yml config file.

# flags.param.summary

Task parameter in key=value format.

# examples

- Run the log task:

  <%= config.bin %> <%= command.id %> log --param message=hello

- Run a custom task:

  <%= config.bin %> <%= command.id %> create-scratch-org --param scratch-def=dev
