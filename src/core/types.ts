/** Runtime context passed to every action during flow execution. */
export type ActionContext = {
  /** Logs a message to the CLI output. */
  log(message: string): void;
};

/** Arbitrary key-value parameters passed to an action from the flow step definition. */
export type ActionParams = Record<string, unknown>;

/** Arguments passed to an action's `run` function. */
export type ActionArgs = ActionContext & { params: ActionParams };

/** Arguments passed to an action's `onError` function. */
export type ActionErrorArgs = ActionContext & { error: unknown; params: ActionParams };

/** The function signature for an action's main execution logic. */
export type ActionFn = (args: ActionArgs) => Promise<void>;

/** Defines the implementation of a named action, including optional error handling. */
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
} & ActionParams;

/** The top-level structure of a `ship.yml` configuration file. */
export type ShipConfig = {
  /** Directory used to resolve custom actions and other ship assets. Defaults to `.ship`. */
  shipDir?: string;
  /** Named flows, each consisting of an ordered list of steps to execute. */
  flows?: Record<string, FlowStep[]>;
};
