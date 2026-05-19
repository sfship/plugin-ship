# 2GP Flow Work Plan

Maps the **2GP-relevant** subset of CumulusCI's standard flows (`CCI_Flow_Reference.md`)
onto plugin-ship flows + tasks. Flows are written under `src/core/flows/` already, as
though every task exists — they double as the spec for the tasks still to be built.

## Design notes

1. **No nested flows (yet).** A flow step can only reference a `task`
   ([flow.definition.schema.ts](src/core/flows/../flow.definition.schema.ts)).
   CCI composes flows-of-flows; we flatten. Shared blocks (`dependencies`,
   `config_qa`/`config_apextest`) are therefore duplicated inline across
   `install-2gp-commit`, `qa-org-2gp`, `ci-feature-2gp`.
   **Recommended first task:** add a `flow:` step type to
   `flow.definition.schema.ts` + `flow.runner.ts` so these compose like CCI and
   the duplication collapses. Until then, treat the duplicated blocks as the
   source of truth in `install-2gp-commit.yml`.
2. **sfdx-native, so dropped from every CCI flow:** `dx_convert_from`,
   `create_managed_src` / `revert_managed_src`, `unschedule_apex`,
   `update_package_xml`, `uninstall_packaged_incremental`. These exist only for
   1GP packaging-org / non-sfdx source. Not applicable to a 2GP project.
3. **Granular passthroughs.** Each CCI compound task becomes one or more thin
   passthroughs to an `sf` command, per the project philosophy.
4. **`target-org` is a flow param**, not an auto-created scratch org — faithful
   to CCI (`cci flow run qa_org_2gp --org dev`). plugin-ship's `ci.yml` instead
   creates a scratch org first; prepend an `org/create/scratch` step to any of
   these if you want that behavior.

## CCI task → plugin-ship task mapping

| CCI task                  | plugin-ship task                                                             | sf passthrough                                           | Status     |
| ------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| `update_dependencies`     | `package/install/dependencies`                                               | (resolver)                                               | **exists** |
| `deploy_pre`              | `metadata/deploy/bundles` (path `unpackaged/pre`)                            | `project deploy start` per bundle                        | **new**    |
| `deploy_post`             | `metadata/deploy/bundles` (path `unpackaged/post`, `inject-namespace: true`) | `project deploy start` per bundle                        | **new**    |
| `install_managed` (2GP)   | `package/install`                                                            | `package install`                                        | **exists** |
| `github_package_data`     | `package/version/list`                                                       | `package version list`                                   | **new**    |
| `create_package_version`  | `package/version/create`                                                     | `package version create`                                 | **new**    |
| `promote_package_version` | `package/version/promote`                                                    | `package version promote`                                | **new**    |
| `update_admin_profile`    | `org/admin-profile/update`                                                   | — (retrieve/grant/redeploy; **not a clean passthrough**) | **new**    |
| `load_sample_data`        | `data/import`                                                                | `data import tree`                                       | **new**    |
| `snapshot_changes`        | `org/tracking/reset`                                                         | `project reset tracking`                                 | **new**    |
| `run_tests`               | `apex/run/test`                                                              | `apex run test`                                          | **exists** |
| `github_release`          | `github/release/create`                                                      | — (GitHub API, cf. `github/repo/info`)                   | **new**    |
| `github_release_notes`    | `github/release/notes`                                                       | — (GitHub API)                                           | **new**    |
| `github_automerge_main`   | `github/branch/merge`                                                        | — (GitHub API)                                           | **new**    |

## Tasks to build (in dependency order)

1. `package/version/list` — outputs `version-id` (latest 04t for the project package). Params: `package`, `target-dev-hub`, `released` (bool), `branch`.
2. `package/version/create` — passthrough `sf package version create`. Outputs `version-id` (04t). Params: `package`, `installation-key`/`installation-key-bypass`, `code-coverage`, `skip-validation`, `version-name`, `version-number`, `tag`, `branch`, `wait`, `target-dev-hub`.
3. `package/version/promote` — passthrough `sf package version promote`. Params: `version-id` (04t/alias), `target-dev-hub`, `no-prompt`.
4. `metadata/deploy/bundles` — deploys each immediate subdirectory of `path` via `project deploy start`; **no-ops if `path` is absent** (CCI deploy_pre/post are conditional). Params: `target-org`, `path`, `inject-namespace` (bool → token-replace `%%%NAMESPACE%%%` etc. before deploy, reuse `util.token`), `wait`.
5. `data/import` — passthrough `sf data import tree`. Params: `target-org`, `plan` or `files`. No-op if neither configured.
6. `org/tracking/reset` — passthrough `sf project reset tracking`. Params: `target-org`, `no-prompt`.
7. `org/admin-profile/update` — retrieve Admin profile, grant object/field/tab/app perms for the package, redeploy. Not a passthrough; CCI-specific. Lowest priority — flows still run without it via `ignore-failure` if you'd rather defer.
8. `github/release/create`, `github/release/notes`, `github/branch/merge` — GitHub-API-backed, same pattern as `github/repo/info` (token via `service.github`).

## Flows produced

| Flow file                    | CCI lineage                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| `dependencies.yml`           | `dependencies`                                                              |
| `build-2gp.yml`              | `build_feature_test_package`                                                |
| `install-2gp-commit.yml`     | `install_2gp_commit` (+ inlined `dependencies`)                             |
| `qa-org-2gp.yml`             | `qa_org_2gp` (= `install_2gp_commit` + `config_qa` + `snapshot_changes`)    |
| `ci-feature-2gp.yml`         | `ci_feature_2gp` (= `install_2gp_commit` + `config_apextest` + `run_tests`) |
| `release-2gp-beta.yml`       | `release_2gp_beta`                                                          |
| `release-2gp-production.yml` | `release_2gp_production`                                                    |
