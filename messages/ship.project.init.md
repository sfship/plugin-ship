# summary

Initialize a new plugin-ship project in the current directory.

# description

Runs sf project generate to scaffold a standard Salesforce project, then patches sfdx-project.json with 2GP settings and writes ship.yml and .ship/orgs scratch org definitions. Existing files are left untouched.

# flags.template.summary

Template to use for project generation.

# flags.api-version.summary

Override the API version used for API requests made by this command.

# flags.lwc-language.summary

Default language to use for LWC components (javascript or typescript).

# examples

- <%= config.bin %> <%= command.id %>
