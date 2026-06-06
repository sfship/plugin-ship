import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIELDS_TO_STRIP = ['versionName', 'versionNumber', 'versionDescription'] as const;

export async function normalizeSfdxProject(projectDir: string): Promise<void> {
  const path = join(projectDir, 'sfdx-project.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return;
  }
  const parsed = JSON.parse(raw) as {
    [key: string]: unknown;
    packageDirectories?: Array<Record<string, unknown>>;
    packageAliases?: Record<string, string>;
  };

  let changed = false;

  if (parsed.packageDirectories) {
    for (const dir of parsed.packageDirectories) {
      for (const field of FIELDS_TO_STRIP) {
        if (field in dir) {
          delete dir[field];
          changed = true;
        }
      }
    }
  }

  if (parsed.packageAliases) {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.packageAliases)) {
      if (key.includes('@')) {
        changed = true;
        continue;
      }
      cleaned[key] = value;
    }
    parsed.packageAliases = cleaned;
  }

  if (changed) {
    await writeFile(path, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  }
}
