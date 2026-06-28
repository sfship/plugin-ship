---
title: sf ship
description: Salesforce CLI plugin for the full package development and release lifecycle.
---

:::caution
This plugin is in beta. Don't use it in production!
:::

A Salesforce CLI plugin for the full development and release lifecycle of second-generation managed and unlocked packages.

Leverage built-in orchestration flows and tasks, or define your own flows in YAML and tasks as JavaScript modules.

```yaml title=".ship/flows/tutorial/greeting.yml"
description: An example custom flow to show in the tutorial.
params:
  - name: name
    required: false
    description: The name to greet
steps:
  greet-user:
    task: tutorial/greet
    params:
      name: ${{ params.name }}
```

```js title=".ship/tasks/tutorial/greet.mjs"
export default {
  description: 'Logs a greeting message.',
  params: [{ name: 'name', type: 'string', required: false }],
  async run({ params, flow, output }) {
    const msg = `Good morning, ${params.name ?? 'Commander'}.`;
    output.set('message', msg);
    flow.log(msg);
  },
};
```

```sh title="Run the Flow"
sf ship flow run tutorial/greeting --param name=Dave
```

```text title="Output"
=== Flow Run

Flow: tutorial/greeting

Steps
   1. greet-user               → tutorial/greet

→ Task [1/1] greet-user · tutorial/greet
15:01:10 [greet-user] Good morning, Dave.
✓ greet-user

Flow Summary
  ✓ greet-user

1 passed · 0 failed · 0 skipped · 0 ignored

✓ Flow "tutorial/greeting" finished successfully!
```
