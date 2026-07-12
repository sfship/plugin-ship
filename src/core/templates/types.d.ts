/*
 * Type declarations for custom ship tasks. Managed by `sf ship project init`;
 * re-running init overwrites this file, so don't edit it.
 *
 * These types are ambient: with the sibling jsconfig.json in place, annotate a
 * task's default export and your editor checks and completes it — no imports:
 *
 *   /** @type {Ship.TaskDefinition} *\/
 *   export default { ... };
 */

declare namespace Ship {
  /** A value that can be passed as a task or flow param. */
  type ParamValue = string | number | boolean | Record<string, string>;

  /** A resolved, validated set of params, keyed by param name. */
  type Params = Record<string, ParamValue>;

  /** A single param declaration. Param names are kebab-case. */
  type ParamDefinition = {
    name: string;
    /** Defaults to "string". */
    type?: 'string' | 'number' | 'boolean' | 'record';
    required?: boolean;
    default?: string | number | boolean;
    description?: string;
  };

  /** Describes a value this task writes to the flow outputs. */
  type TaskOutputDefinition = {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
  };

  /** A single entry in a `ship.yml` dependency list. */
  type ShipDependency = { github: string; tag?: string; name?: string } | { versionId: string; name?: string };

  /** The validated top-level ship configuration. */
  type ShipConfig = {
    project: {
      slug: string;
      package?: {
        name: string;
        namespace?: string;
        type: 'Managed' | 'Unlocked';
        permsets?: string[];
        testPattern: string;
        dependencies?: ShipDependency[];
      };
      git?: { defaultBranch?: string; repoUrl?: string };
    };
    dir: string;
  };

  /** A `@salesforce/core` Org instance. Only commonly used members are declared here. */
  type SalesforceOrg = {
    getOrgId: () => string;
    getUsername: () => string | undefined;
  };

  /** Registry for accessing Salesforce orgs and their definitions. */
  type OrgRegistry = {
    /** Qualifies a project alias (e.g. "dev" -> "myproject:dev"); usernames and foreign aliases pass through. */
    resolveAlias: (alias: string) => string;
    /** Returns a cached Org instance for the given alias. */
    getOrg: (alias: string) => Promise<SalesforceOrg>;
    /** Returns the scratch org definition for the given alias. */
    getDef: (alias: string) => Record<string, unknown>;
  };

  /** The context of the flow run this task is part of. */
  type FlowContext = {
    /** Absolute path to the directory containing `ship.yml` — the project root. */
    projectDir: string;
    /** Absolute path to the `.ship` directory for the current project. */
    shipDir: string;
    /** The loaded ship configuration for this project. */
    config: ShipConfig;
    /** Registry for accessing Salesforce orgs and their definitions. */
    orgs: OrgRegistry;
    /** Writes a log message to the flow's output. */
    log: (message: string) => void;
    /** The params the flow was invoked with. */
    params: Params;
    /** True if any step has failed with ignore-failure during this flow run. */
    hasFailures: boolean;
    /** Invokes an sf CLI command in-process via oclif's plugin system. */
    runCommand: (id: string, argv: string[]) => Promise<unknown>;
  };

  /** Reads and writes named output values for this step. */
  type TaskOutput = {
    /** Writes a named output, available to later steps via `${{ steps.<id>.<key> }}`. */
    set: (key: string, value: unknown) => void;
    /** Reads this step's own output by key, or another step's output by (stepId, key). */
    get: (keyOrStepId: string, key?: string) => unknown;
  };

  /** The runtime context passed to a task's `run()` method. */
  type TaskContext = {
    flow: FlowContext;
    params: Params;
    output: TaskOutput;
  };

  /** The shape a task file must default-export. */
  type TaskDefinition = {
    description?: string;
    params?: ParamDefinition[];
    outputs?: TaskOutputDefinition[];
    run: (context: TaskContext) => Promise<void>;
  };
}
