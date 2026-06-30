# Getting Started

This project uses [SF Ship](https://sfship.github.io/plugin-ship/) to manage its development and release lifecycle. Follow these steps to set it up.

## 1. Set a default Dev Hub

Required for creating scratch orgs and packaging. Skip if you already have one.

```
sf org login web --set-default-dev-hub
```

## 2. Connect GitHub

Lets ship create releases and read repository metadata during release flows.

```
sf ship service connect github
```

## 3. Register your package

Run once to register the 2GP package on your Dev Hub and write its ID into `sfdx-project.json`. Commit the change.

```
sf ship flow run create/package
```

## 4. Create a dev org

Spin up a scratch org with your source deployed and dependencies installed.

```
sf ship flow run deploy/dev
```

## Documentation

Full guides and command reference: <https://sfship.github.io/plugin-ship/>
