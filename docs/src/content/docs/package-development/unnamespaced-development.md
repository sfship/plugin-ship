---
title: Unnamespaced Development
description: Work in scratch orgs without your package namespace, using namespace tokens where metadata needs them.
sidebar:
  order: 6
---

Scratch orgs created by ship carry your package namespace by default. That requires access to the Dev Hub the namespace is linked to — which outside contributors to your project don't have. This page covers developing without the namespace, and making metadata work in both worlds.

:::note[Do you need this?]
For most packages — ISV or internal — the namespaced defaults are the right choice, and you can skip this page entirely. Follow these steps only if your project must support developers who can't create namespaced scratch orgs, such as outside contributors to an open-source package.
:::

## Creating an Unnamespaced Org

Pass `no-namespace` to the dev flow:

```sh
sf ship flow run deploy/dev --param no-namespace=true
```

The org is created without the namespace and your source deploys unmanaged. For a project whose contributors mostly work this way, eject the flow and change the param's default to `true`.

Package versions can't be built or promoted without the namespace-linked Dev Hub, so releasing and the package-install flows (`deploy/feature`, `beta`, `qa`, `regression`) remain maintainer-side. Contributors develop and test source; CI owned by the maintainer validates against the real package.

## Namespace Tokens

Most projects need nothing further: packaged source is prefix-free by nature, and it deploys identically with or without a namespace. Tokens are only needed when metadata must reference packaged components by qualified name in _both_ contexts — unpackaged permission sets, and occasionally Flows, quick actions, or LWC inside the package.

The mechanism is the Salesforce CLI's own [string replacements](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_string_replace.htm): tokens in your metadata are swapped for environment variable values on every deploy and package version create.

The namespace takes three syntactic forms in Salesforce metadata, so there are three tokens:

| Token         | Namespaced context | Unnamespaced org | Used for                          |
| ------------- | ------------------ | ---------------- | --------------------------------- |
| `%%NS%%`      | `myns__`           | (empty)          | Object and field references       |
| `%%NS_DOT%%`  | `myns.`            | (empty)          | Apex class references             |
| `%%NS_OR_C%%` | `myns`             | `c`              | Aura and LWC component references |

Declare the replacements once in `sfdx-project.json`:

```json title="sfdx-project.json"
"replacements": [
  {
    "glob": "unpackaged/**",
    "stringToReplace": "%%NS%%",
    "replaceWithEnv": "SHIP_NS",
    "allowUnsetEnvVariable": true
  },
  {
    "glob": "unpackaged/**",
    "stringToReplace": "%%NS_DOT%%",
    "replaceWithEnv": "SHIP_NS_DOT",
    "allowUnsetEnvVariable": true
  },
  {
    "glob": "unpackaged/**",
    "stringToReplace": "%%NS_OR_C%%",
    "replaceWithEnv": "SHIP_NS_OR_C"
  }
]
```

`allowUnsetEnvVariable` means an unset variable replaces the token with nothing — the correct value for the first two forms in unnamespaced orgs. `%%NS_OR_C%%` never resolves to nothing: unnamespaced components live in the default `c` namespace, so its variable must always be set.

Where each form appears:

**`%%NS%%`** — anywhere an object or field is referenced by API name, such as a permission set:

```xml title="unpackaged/post/permissionsets/Widget_Admin.permissionset-meta.xml"
<field>%%NS%%Widget__c.%%NS%%Notes__c</field>
```

**`%%NS_DOT%%`** — anywhere an Apex class is referenced from outside the package, such as a Visualforce controller:

```html title="unpackaged/post/pages/WidgetAdmin.page"
<apex:page controller="%%NS_DOT%%WidgetController"></apex:page>
```

**`%%NS_OR_C%%`** — anywhere an Aura or LWC component is referenced by namespace, such as a Flow screen component:

```xml
<extensionName>%%NS_OR_C%%:widgetPicker</extensionName>
```

## Setting the Variables in Flows

Flows set the environment with the [`util/env/set`](/plugin-ship/reference/tasks/#utilenvset) task, so nobody manages shell state by hand. Because ship runs `sf` commands in-process, values set by a step apply to every deploy after it.

In an ejected `deploy/dev`, source deploys unmanaged, so references are unprefixed:

```yaml title=".ship/flows/deploy/dev.yml"
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@sfship/plugin-ship@beta/lib/schemas/flow.schema.json
steps:
  set-env:
    task: util/env/set
    params:
      vars:
        SHIP_NS: ''
        SHIP_NS_DOT: ''
        SHIP_NS_OR_C: c
  create-org:
    task: org/create/scratch
    params:
      scratch-def: dev
      duration: 30
      no-namespace: ${{ params.no-namespace }}
  # ...remaining steps unchanged
```

In ejected package-install flows (`deploy/feature`, `beta`, `qa`, `regression`), the installed package is namespaced, so references need the prefix:

```yaml title=".ship/flows/deploy/feature.yml"
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@sfship/plugin-ship@beta/lib/schemas/flow.schema.json
steps:
  set-env:
    task: util/env/set
    params:
      vars:
        SHIP_NS: ${{ config.project.package.namespace }}__
        SHIP_NS_DOT: ${{ config.project.package.namespace }}.
        SHIP_NS_OR_C: ${{ config.project.package.namespace }}
  # ...remaining steps unchanged
```

## Beyond Namespaces

Any step output can reach deployed metadata the same way. For example, stamping the built package version into a custom label:

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@sfship/plugin-ship@beta/lib/schemas/flow.schema.json
steps:
  set-version-env:
    task: util/env/set
    params:
      vars:
        SHIP_VERSION: ${{ steps.create-version.version-number }}
```

with a `%%VERSION%%` replacement entry and a token in the label's value.

## Limitations

- Replacements rewrite file contents only. Metadata whose file or directory _names_ carry the namespace (such as adding a field to a packaged object from unpackaged source) can't be tokenized — keep separate directories per context and gate them with the flow's `if` conditions.
