---
title: Unpackaged Metadata
description: Deploy org configuration that lives outside your package with unpackaged/pre and unpackaged/post.
sidebar:
  order: 5
---

Some metadata belongs in an org but not in your package. Place it in `unpackaged/pre` or `unpackaged/post` at the project root.

## Directory Layout

```text
my-project/
├── force-app/          # packaged source
├── unpackaged/
│   ├── pre/            # deploys before your package
│   └── post/           # deploys after your package
└── ship.yml
```

Both directories are optional. Flows check for them and skip the deploy steps when they don't exist.

## When Each Deploys

- **`unpackaged/pre`** deploys after dependencies install, before your package. Use it for metadata your package needs in the org before it arrives — record types it assumes exist, settings its post-install logic reads, etc.
- **`unpackaged/post`** deploys after your package is in the org — source-deployed in `deploy/dev`, installed in `deploy/feature`, `beta`, `qa`, and `regression`. Use it for configuration on top of the app: permission sets, sample settings, admin conveniences.

## Namespace References

Write namespace prefixes literally when unpackaged metadata references packaged components:

```xml
<field>myns__Widget__c.myns__Notes__c</field>
```

This works in every org the flows create: namespaced dev orgs resolve the explicit prefix, and orgs with the installed package require it. There is no token injection by default — if your project needs the same metadata to work in both namespaced and unnamespaced contexts, see [Unnamespaced Development](/plugin-ship/package-development/unnamespaced-development/).
