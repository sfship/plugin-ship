---
title: Working With Dependencies
description: How to declare package dependencies.
---

<!-- TODO: Explain how to declare dependencies in ship.yml -->

## Lock Dependencies

Resolves dependencies from `ship.yml` into `sfdx-project.json`. Run this whenever your dependencies change and commit the result before cutting a release.

```bash
sf ship flow run dependencies/lock
```
