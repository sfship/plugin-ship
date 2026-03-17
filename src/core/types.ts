import { Org } from '@salesforce/core';

/** Runtime context passed to every action during flow execution. */
export type ActionContext = {
  /** The full parsed ship.yml config. */
  config: ShipConfig;
  /** Absolute path to the project root (where ship.yml lives). */
  cwd: string;
  /**
   * Resolves an org by alias or username. Results are memoized so repeated
   * calls within the same flow do not re-instantiate the org.
   *
   * @param aliasOrUsername - The org alias or username to resolve.
   */
  getOrg(aliasOrUsername: string): Promise<Org>;
  /**
   * Spawns a shell command, inheriting stdio so output passes through to the terminal.
   * Rejects if the process exits with a non-zero code.
   *
   * @param command - The command string to execute.
   */
  exec(command: string): Promise<void>;
  /**
   * Emits a log message to the user.
   *
   * @param message - The message to display.
   */
  log(message: string): void;
  /**
   * Writes a value to the flow's shared context, accessible in subsequent
   * steps via `${{ context.key }}` interpolation.
   *
   * @param key - The context variable name.
   * @param value - The value to store.
   */
  set(key: string, value: unknown): void;
  /**
   * Reads a value previously written by an earlier step via {@link ActionContext.set}.
   *
   * @param key - The context variable name.
   */
  get(key: string): unknown;
};

/** Arbitrary key-value parameters passed to an action from the flow step definition. */
export type ActionParams = Record<string, unknown>;

/**
 * Arguments passed to an action's `run` function.
 */
export type ActionArgs = ActionContext & { params: ActionParams };

/**
 * Arguments passed to an action's `onError` function.
 */
export type ActionErrorArgs = ActionContext & { error: unknown; params: ActionParams };

/**
 * The function signature for an action's main execution logic.
 */
export type ActionFn = (args: ActionArgs) => Promise<void>;

/**
 * Defines the implementation of a named action, including optional error handling.
 */
export type ActionDefinition = {
  /** The main execution function for the action. */
  run: ActionFn;
  /** Optional handler invoked if `run` throws. */
  onError?: (args: ActionErrorArgs) => Promise<void>;
};

/** A single step in a flow, referencing an action by name plus any parameters it requires. */
export type FlowStep = {
  /** The name of the action to execute. */
  action: string;
  /** Optional label shown in the spinner while this step runs. Defaults to the action name. */
  label?: string;
  /** Parameters passed to the action. */
  params?: ActionParams;
};

/** Package metadata for the Salesforce project. */
export type ProjectPackageConfig = {
  /** The package name as it appears in the Salesforce packaging UI. */
  name: string;
  /** The package namespace. */
  namespace?: string;
};

/** Git configuration for the project. */
export type ProjectGitConfig = {
  /** The main branch name. Defaults to `main`. */
  defaultBranch?: string;
  /** The GitHub repository URL. */
  repoUrl?: string;
};

/** Top-level project metadata. */
export type ProjectConfig = {
  /** The project name, used as a prefix for generated aliases etc. */
  name: string;
  /** Optional Salesforce package metadata. */
  package?: ProjectPackageConfig;
  /** Optional Git repository configuration. */
  git?: ProjectGitConfig;
};

/** A named flow with optional declared params and an ordered list of steps. */
export type FlowDefinition = {
  /** Param names this flow accepts, passed as CLI flags when invoking the flow. */
  params?: string[];
  /** Ordered list of steps to execute. */
  steps: FlowStep[];
};

/** The top-level structure of a `ship.yml` configuration file. */
export type ShipConfig = {
  /** Project metadata. */
  project?: ProjectConfig;
  /** Directory used to resolve custom actions and other ship assets. Defaults to `.ship`. */
  dir?: string;
  /** The SF CLI executable to use when calling `runSf`. Defaults to `sf`. */
  cli?: string;
  /** Named flows, each consisting of an ordered list of steps to execute. */
  flows?: Record<string, FlowDefinition>;
};
