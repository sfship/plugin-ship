# summary

Copy a standard flow into your project for customization.

# description

Copies a built-in flow definition into your project's .ship/flows/ directory so you can modify it. Fails if the flow is not a built-in, or if the destination file already exists.

# args.flowName.summary

The name of the built-in flow to eject.

# flags.config.summary

Path to the ship.yml config file.

# examples

- Eject the ci flow into your project:

  <%= config.bin %> <%= command.id %> ci
