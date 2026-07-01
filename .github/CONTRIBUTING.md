# Contributing to plugin-ship

Thanks for your interest! This plugin manages the full development and release
lifecycle for second-generation Salesforce packages. Bug reports, fixes,
features, and docs improvements are all welcome.

## Getting set up

```bash
git clone https://github.com/sfship/plugin-ship.git
cd plugin-ship
yarn              # install dependencies
yarn build        # compile
sf plugins link . # run your local build through the sf CLI
```

## Running the tests

```bash
yarn test         # unit tests + lint
yarn test:nuts    # integration tests (NUTs)
```

> The NUTs create real scratch orgs, so they require a Salesforce **Dev Hub**
> authenticated to the CLI. The unit tests do not.

## Branching — where to open your PR

This repo uses a beta channel:

- **`prerelease/beta`** — the active development branch; betas are published from
  it. **Open code changes (features, fixes, tests) against this branch.**
- **`main`** — stable releases and the documentation site. **Open
  documentation-only changes against this branch.**

Stable releases are cut by merging `prerelease/beta` into `main`.

## Commits & PR titles

Commit messages and PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/) —
`type: lowercase summary`. This is enforced by a commit hook and drives
automated versioning and the changelog.

| Type       | When to use                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New feature (triggers a minor release)         |
| `fix`      | Bug fix (triggers a patch release)             |
| `docs`     | Documentation only                             |
| `test`     | Adding or updating tests                       |
| `refactor` | Code change that's neither a fix nor a feature |
| `chore`    | Maintenance (deps, config, tooling)            |
| `ci`       | CI/CD config                                   |
| `build`    | Build system                                   |
| `perf`     | Performance improvement                        |
| `style`    | Formatting, whitespace (no logic change)       |

Only `feat`, `fix`, and `perf` produce a release; the rest don't.

## Opening a pull request

1. Fork the repo and branch from the right base (`prerelease/beta` for code,
   `main` for docs).
2. Make your change, with tests where it makes sense.
3. Make sure `yarn test` passes.
4. Open the PR with a conventional-commit title. CI runs the suite on your PR.

## Questions

Check the [documentation](https://sfship.github.io/plugin-ship/) first, then
open an issue if you're still stuck.
