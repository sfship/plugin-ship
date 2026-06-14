import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type InitOptions = {
  packageName: string;
  namespace?: string;
  packageType: 'Managed' | 'Unlocked';
  repoUrl?: string;
};

export type InitResult = {
  created: string[];
  skipped: string[];
};

function writeIfAbsent(absPath: string, relPath: string, content: string, result: InitResult): void {
  if (existsSync(absPath)) {
    result.skipped.push(relPath);
    return;
  }
  writeFileSync(absPath, content, 'utf8');
  result.created.push(relPath);
}

function buildShipYml({ packageName, namespace, packageType, repoUrl }: InitOptions): string {
  const lines = ['project:', '  package:', `    name: ${packageName}`];
  if (namespace) lines.push(`    namespace: ${namespace}`);
  lines.push(`    type: ${packageType}`);
  lines.push('  git:', '    defaultBranch: main');
  if (repoUrl) lines.push(`    repoUrl: ${repoUrl}`);
  return lines.join('\n') + '\n';
}

function patchSfdxProjectJson(projectDir: string, { packageName, namespace, packageType }: InitOptions): void {
  const filePath = join(projectDir, 'sfdx-project.json');
  if (!existsSync(filePath)) return;

  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
    [key: string]: unknown;
    packageDirectories: Array<Record<string, unknown>>;
    namespace?: string;
  };

  const defaultDir = raw.packageDirectories.find((d) => d.default) ?? raw.packageDirectories[0];
  if (defaultDir) {
    defaultDir.package = packageName;
    defaultDir.versionName = 'ver 0.1';
    defaultDir.versionNumber = '0.0.0.NEXT';
    if (packageType === 'Managed') {
      defaultDir.ancestorVersion = 'HIGHEST';
    }
  }

  if (namespace) {
    raw.namespace = namespace;
  }

  writeFileSync(filePath, JSON.stringify(raw, null, 4) + '\n', 'utf8');
}

function appendToGitignore(projectDir: string): void {
  const filePath = join(projectDir, '.gitignore');
  const entry = '\n# sf-ship\n.ship/tmp/\n';
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  if (!existing.includes('.ship/tmp/')) {
    appendFileSync(filePath, entry, 'utf8');
  }
}

function appendToForceignore(projectDir: string): void {
  const filePath = join(projectDir, '.forceignore');
  const entry = [
    '',
    '# sf-ship',
    '**/*.profile-meta.xml',
    '**/*.appMenu-meta.xml',
    '**/sfdcInternalInt__*.permissionset-meta.xml',
    '',
  ].join('\n');
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  if (!existing.includes('# sf-ship')) {
    appendFileSync(filePath, entry, 'utf8');
  }
}

function buildReadme({ packageName }: InitOptions): string {
  return `# ${packageName}

## Create a Dev Org

Spin up a personal scratch org with your source deployed and dependencies installed:

\`\`\`
sf ship flow run deploy/dev
\`\`\`

## Retrieve Metadata

After making changes in the org, pull them back locally:

\`\`\`
sf project retrieve start
\`\`\`

## Create a Release

Build and promote a new package version through environments:

\`\`\`
sf ship flow run release/beta
\`\`\`

## Promote a Package Version

\`\`\`
sf ship flow run release/production
\`\`\`

## Documentation

TODO
`;
}

const commonSettings = {
  lightningExperienceSettings: { enableS1DesktopEnabled: true },
  securitySettings: {
    enableAdminLoginAsAnyUser: true,
    sessionSettings: { forceRelogin: false },
  },
};

function buildOrgDefs(packageName: string): Record<string, object> {
  const label = (env: string): string => `${packageName}:${env}`;
  return {
    dev: {
      orgName: label('dev'),
      edition: 'Developer',
      hasSampleData: true,
      settings: {
        ...commonSettings,
        userManagementSettings: { permsetsInFieldCreation: true, enableEnhancedPermsetMgmt: true },
      },
    },
    feature: { orgName: label('feature'), edition: 'Developer', settings: commonSettings },
    beta: { orgName: label('beta'), edition: 'Developer', settings: commonSettings },
    qa: { orgName: label('qa'), edition: 'Enterprise', hasSampleData: true, settings: commonSettings },
    regression: { orgName: label('regression'), edition: 'Enterprise', settings: commonSettings },
    release: { orgName: label('release'), edition: 'Enterprise', settings: commonSettings },
  };
}

export function initProject(options: InitOptions, projectDir: string): InitResult {
  const result: InitResult = { created: [], skipped: [] };

  const orgsDir = join(projectDir, '.ship', 'orgs');
  mkdirSync(orgsDir, { recursive: true });

  patchSfdxProjectJson(projectDir, options);
  appendToGitignore(projectDir);
  appendToForceignore(projectDir);
  writeFileSync(join(projectDir, 'README.md'), buildReadme(options), 'utf8');
  const legacyConfigDir = join(projectDir, 'config');
  if (existsSync(legacyConfigDir)) rmSync(legacyConfigDir, { recursive: true });
  writeIfAbsent(join(projectDir, 'ship.yml'), 'ship.yml', buildShipYml(options), result);

  for (const [name, def] of Object.entries(buildOrgDefs(options.packageName))) {
    writeIfAbsent(
      join(orgsDir, `${name}.json`),
      `.ship/orgs/${name}.json`,
      JSON.stringify(def, null, 4) + '\n',
      result
    );
  }

  return result;
}
