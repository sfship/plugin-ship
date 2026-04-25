import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { ZodError } from 'zod';
import { listDir, readText } from '@plugin-ship/core/file.js';
import { FlowDefinition, FlowDefinitionSchema } from '@plugin-ship/core/config.js';
import { ExpectedError, formatZodError } from './error.utils.js';

const builtinsDir = resolve(fileURLToPath(import.meta.url), '..', 'flows');

function scanDir(dir: string): string[] {
  try {
    return listDir(dir, { recursive: true })
      .filter((f) => f.endsWith('.yml'))
      .map((f) => f.replaceAll('\\', '/'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return [];
  }
}

function loadFromPath(flowPath: string): FlowDefinition {
  let raw: string;
  try {
    raw = readText(flowPath);
  } catch (err) {
    throw new ExpectedError(`Failed to load flow at ${flowPath}: ${(err as Error).message}`);
  }
  const parsed = parse(raw) as unknown;
  const result = FlowDefinitionSchema.safeParse(parsed);
  if (!result.success)
    throw new ExpectedError(`Invalid flow definition at ${flowPath}:\n${formatZodError(result.error as ZodError)}`);
  return result.data;
}

/**
 * Resolves flow definitions by name.
 *
 * On construction, scans both the built-in and consumer flow directories and
 * merges with flows defined inline in ship.yml. Later sources shadow earlier ones:
 * built-ins → .ship/flows/ → ship.yml.
 */
export class FlowRegistry {
  private readonly shipDir: string;
  private readonly flows: Map<string, FlowDefinition>;

  /** @param shipDir - The ship directory for this project. Consumer flows are loaded from `<shipDir>/flows`. */
  public constructor(shipDir: string, configFlows?: Record<string, FlowDefinition>) {
    this.shipDir = shipDir;
    this.flows = new Map();

    for (const file of scanDir(builtinsDir))
      this.flows.set(file.replace(/\.yml$/, ''), loadFromPath(resolve(builtinsDir, file)));

    for (const file of scanDir(resolve(shipDir, 'flows')))
      this.flows.set(file.replace(/\.yml$/, ''), loadFromPath(resolve(shipDir, 'flows', file)));

    if (configFlows) for (const [name, def] of Object.entries(configFlows)) this.flows.set(name, def);
  }

  /** Lists all available flow names. */
  public list(): string[] {
    return [...this.flows.keys()].sort();
  }

  /**
   * Returns the flow definition for the given name.
   *
   * @param flowName - The flow name, e.g. "ci" or "managed-package/release".
   * @throws If the flow cannot be found in any source.
   */
  public resolveFlow(flowName: string): FlowDefinition {
    const flow = this.flows.get(flowName);
    if (!flow)
      throw new ExpectedError(`Unknown flow "${flowName}". Looked in: ${resolve(this.shipDir, 'flows', flowName)}`);
    return flow;
  }
}
