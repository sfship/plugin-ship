import type { TaskContext, TaskDefinition } from '../../../task.js';
import { ExpectedError } from '../../../util.error.js';

type PackageVersion = {
  SubscriberPackageVersionId: string;
  Version?: string;
  IsReleased: boolean;
  Branch?: string | null;
  Name?: string;
  CreatedDate: string;
};

export default {
  description:
    'Resolves the latest package version ID for the project package. Passthrough for `sf package version list`.',
  params: [
    {
      name: 'package',
      type: 'string',
      required: false,
      description: 'Package name, ID, or alias to look up. Defaults to the project package from ship.yml.',
    },
    {
      name: 'target-dev-hub',
      type: 'string',
      required: false,
      description: 'Dev hub alias or username. Defaults to the SF CLI default target-dev-hub.',
    },
    {
      name: 'released',
      type: 'boolean',
      required: false,
      default: false,
      description:
        'When true, resolve the latest released version. When false (default), the latest unreleased (beta).',
    },
    {
      name: 'branch',
      type: 'string',
      required: false,
      description: 'Filter to versions built from a specific branch.',
    },
  ],
  outputs: [
    {
      name: 'version-id',
      type: 'string',
      description: 'The 04t SubscriberPackageVersionId of the latest matching package version.',
    },
  ],
  async run({ flow, params, output }: TaskContext): Promise<void> {
    const packageName = (params['package'] as string | undefined) ?? flow.config.project.package?.name;
    if (!packageName) {
      throw new ExpectedError('No package specified. Pass `package` param or set project.package.name in ship.yml.');
    }

    const argv: string[] = ['--packages', packageName];
    if (params['target-dev-hub']) argv.push('--target-dev-hub', params['target-dev-hub'] as string);
    if (params['branch']) argv.push('--branch', params['branch'] as string);
    const wantReleased = params['released'] === true;
    if (wantReleased) argv.push('--released');

    const versions = (await flow.runCommand('package:version:list', argv)) as PackageVersion[];
    const matching = versions.filter((v) => v.IsReleased === wantReleased);

    if (matching.length === 0) {
      throw new ExpectedError(
        `No ${wantReleased ? 'released' : 'unreleased'} versions found for package "${packageName}".`
      );
    }

    // Latest = most recently created. CLI usually returns sorted; sort defensively.
    matching.sort((a, b) => (a.CreatedDate < b.CreatedDate ? 1 : -1));
    const latest = matching[0];

    flow.log(
      `Resolved ${packageName} → ${latest.Version ?? '(unknown version)'} (${latest.SubscriberPackageVersionId})${
        latest.IsReleased ? ' [released]' : ' [beta]'
      }`
    );
    output.set('version-id', latest.SubscriberPackageVersionId);
  },
} satisfies TaskDefinition;
