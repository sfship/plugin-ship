# summary

Run a flow defined in ship.yml.

# description

Reads ship.yml from the current directory, finds the named flow, and executes its actions in sequence.

# flags.name.summary

Kebab-cased name of the flow to run, found in `ship.yml` such as `deploy-dev-org`.

# flags.config.summary

Path to the ship.yml config file.

# flags.param.summary

Flow parameter in key=value format.

# examples

- <%= config.bin %> <%= command.id %> my_flow
