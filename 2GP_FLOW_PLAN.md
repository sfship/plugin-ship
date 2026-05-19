# 2GP Flow Work Plan

Maps the **2GP-relevant** subset of CumulusCI's standard flows (`CCI_Flow_Reference.md`)
onto plugin-ship flows + tasks. Flows are written under `src/core/flows/` already, as
though every task exists — they double as the spec for the tasks still to be built.

One non-2GP flow, `dev-org`, is also included: it's the unmanaged-metadata
development counterpart and replaced the placeholder `ci.yml`. It introduces **no
new tasks** — it reuses the same task set under the same conventions — so it
costs nothing extra against this plan.

## Design notes

1. **No composed flows — a conscious decision.** A flow step can only reference a
   `task`, never another flow ([flow.definition.schema.ts](src/core/flow.definition.schema.ts)).
   We evaluated adding a `flow:` step type so flows could nest like CCI. For this
   2GP subset it nets out negatively: full composition would save ~40 lines of
   YAML (~22%) at a cost of ~200 lines of runtime — schema union, a flow-expansion
   pass, intra-flow `${{ steps.* }}` token rewriting, and cycle detection — plus
   its own test surface. The only real downside of _not_ having it is drift
   between the copies of the install block, which is manageable across two files.
   **Decision: do not support composed flows.** Revisit only if the flow catalog
   grows well beyond this 2GP subset.
   Because building-block flows earn nothing without composition, the standalone
   `dependencies` and `install-2gp-commit` flows were dropped. `qa-org-2gp` and
   `ci-feature-2gp` are the entry points a user actually runs and carry their
   full step lists inline; `install-2gp-commit.yml`'s former step block is
   documented inline in both (the `# --- install_2gp_commit ---` section).
2. **sfdx-native, so dropped from every CCI flow:** `dx_convert_from`,
   `create_managed_src` / `revert_managed_src`, `unschedule_apex`,
   `update_package_xml`, `uninstall_packaged_incremental`. These exist only for
   1GP packaging-org / non-sfdx source. Not applicable to a 2GP project.
3. **Granular passthroughs.** Each CCI compound task becomes one or more thin
   passthroughs to an `sf` command, per the project philosophy.
4. **`target-org` is a flow param** for the 2GP flows, not an auto-created
   scratch org — faithful to CCI (`cci flow run qa_org_2gp --org dev`). The one
   exception is `dev-org`, whose entire purpose is to provision a dev scratch
   org, so it creates one as its first step (`org/create/scratch`) following
   plugin-ship's own idiom.
5. **No auto-merge — a conscious decision.** CCI's `github_automerge_main` /
   `github_automerge_feature` (used by `release_2gp_beta`, `ci_feature`, etc.)
   are deliberately **not** inherited. We do not want flows silently merging
   branches as a side effect of a release or CI run; merging stays a separate,
   explicit human/PR step. `release-2gp-beta.yml` therefore stops after release
   notes, and no `github/branch/merge` task is planned.

## CCI task → plugin-ship task mapping

| CCI task                  | plugin-ship task                                                             | sf passthrough                                           | Status                      |
| ------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------- |
| `update_dependencies`     | `package/install/dependencies`                                               | (resolver)                                               | **exists**                  |
| `deploy_pre`              | `metadata/deploy/bundles` (path `unpackaged/pre`)                            | `project deploy start` per bundle                        | **new**                     |
| `deploy_post`             | `metadata/deploy/bundles` (path `unpackaged/post`, `inject-namespace: true`) | `project deploy start` per bundle                        | **new**                     |
| `deploy` (unmanaged)      | `project/deploy/start`                                                       | `project deploy start`                                   | **exists**                  |
| `install_managed` (2GP)   | `package/install`                                                            | `package install`                                        | **exists**                  |
| `github_package_data`     | `package/version/list`                                                       | `package version list`                                   | **new**                     |
| `create_package_version`  | `package/version/create`                                                     | `package version create`                                 | **new**                     |
| `promote_package_version` | `package/version/promote`                                                    | `package version promote`                                | **new**                     |
| `update_admin_profile`    | `org/admin-profile/update`                                                   | — (retrieve/grant/redeploy; **not a clean passthrough**) | **new**                     |
| `load_sample_data`        | `data/import`                                                                | `data import tree`                                       | **new**                     |
| `snapshot_changes`        | `org/tracking/reset`                                                         | `project reset tracking`                                 | **new**                     |
| `run_tests`               | `apex/run/test`                                                              | `apex run test`                                          | **exists**                  |
| `github_release`          | `github/release/create`                                                      | — (GitHub API, cf. `github/repo/info`)                   | **new**                     |
| `github_release_notes`    | `github/release/notes`                                                       | — (GitHub API)                                           | **new**                     |
| `github_automerge_main`   | —                                                                            | —                                                        | **dropped** (design note 5) |

## Tasks to build (in dependency order)

1. `package/version/list` — outputs `version-id` (latest 04t for the project package). Params: `package`, `target-dev-hub`, `released` (bool), `branch`.
2. `package/version/create` — passthrough `sf package version create`. Outputs `version-id` (04t). Params: `package`, `installation-key`/`installation-key-bypass`, `code-coverage`, `skip-validation`, `version-name`, `version-number`, `tag`, `branch`, `wait`, `target-dev-hub`.
3. `package/version/promote` — passthrough `sf package version promote`. Params: `version-id` (04t/alias), `target-dev-hub`, `no-prompt`.
4. `metadata/deploy/bundles` — deploys each immediate subdirectory of `path` via `project deploy start`; **no-ops if `path` is absent** (CCI deploy_pre/post are conditional). Params: `target-org`, `path`, `inject-namespace` (bool → token-replace `%%%NAMESPACE%%%` etc. before deploy, reuse `util.token`), `wait`.
5. `data/import` — passthrough `sf data import tree`. Params: `target-org`, `plan` or `files`. No-op if neither configured.
6. `org/tracking/reset` — passthrough `sf project reset tracking`. Params: `target-org`, `no-prompt`.
7. `org/admin-profile/update` — retrieve Admin profile, grant object/field/tab/app perms for the package, redeploy. Not a passthrough; CCI-specific. Lowest priority — flows still run without it via `ignore-failure` if you'd rather defer.
8. `github/release/create`, `github/release/notes` — GitHub-API-backed, same pattern as `github/repo/info` (token via `service.github`). No `github/branch/merge` — see design note 5.

Already built and reused: `org/create/scratch`, `package/install`, `package/install/dependencies`, `project/deploy/start`, `apex/run/test`.

## Flows produced

| Flow file                    | CCI lineage                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `dev-org.yml`                | `dev_org` — **non-2GP**, provisions its own scratch org; replaced placeholder `ci.yml` |
| `build-2gp.yml`              | `build_feature_test_package`                                                           |
| `qa-org-2gp.yml`             | `qa_org_2gp` (inlines `install_2gp_commit` + `config_qa` + `snapshot_changes`)         |
| `ci-feature-2gp.yml`         | `ci_feature_2gp` (inlines `install_2gp_commit` + `config_apextest` + `run_tests`)      |
| `release-2gp-beta.yml`       | `release_2gp_beta` (minus `github_automerge_main`)                                     |
| `release-2gp-production.yml` | `release_2gp_production`                                                               |
