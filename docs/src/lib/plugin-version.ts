import rootPkg from '../../../package.json';

type RegistryDoc = {
  'dist-tags': Record<string, string>;
  time: Record<string, string>;
};

/**
 * Resolves the latest published plugin version from the npm registry at build
 * time. Among all dist-tags, the most recently published version wins, so the
 * docs track `beta` while it leads and `latest` once stable releases take over.
 */
async function fetchLatestVersion(): Promise<string> {
  const res = await fetch('https://registry.npmjs.org/@sfship/plugin-ship');
  if (!res.ok) throw new Error(`npm registry responded ${res.status}`);
  const doc = (await res.json()) as RegistryDoc;
  const versions = [...new Set(Object.values(doc['dist-tags']))];
  return versions.sort((a, b) => Date.parse(doc.time[b]) - Date.parse(doc.time[a]))[0];
}

// Fall back to the repo's own version if the registry is unreachable mid-build.
export const pluginVersion = await fetchLatestVersion().catch(() => rootPkg.version);
