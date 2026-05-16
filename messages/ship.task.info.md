# summary

Show details for a task.

# description

Displays the description, accepted params, and store outputs for a built-in or custom task.

# args.taskName.summary

The name of the task to inspect.

# flags.config.summary

Path to the ship.yml config file.

# examples

- Show details for a built-in task:

  <%= config.bin %> <%= command.id %> org/create/scratch

- Show details for a custom task:

  <%= config.bin %> <%= command.id %> my-custom-task
