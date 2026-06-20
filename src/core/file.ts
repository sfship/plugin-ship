import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/* c8 ignore start */

/** Returns true if the path exists on the filesystem. */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Creates a directory and any missing parents. No-ops if it already exists. */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/** Lists all entries in a directory. */
export function listDir(path: string, options?: { recursive?: boolean }): string[] {
  return readdirSync(path, options) as string[];
}

/** Reads a file as a UTF-8 string. */
export function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Reads and parses a JSON file. */
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Writes a value as pretty-printed JSON to a file. */
export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/** Writes a UTF-8 string to a file. */
export function writeText(path: string, content: string): void {
  writeFileSync(path, content);
}

/** Removes a file. Throws if the file does not exist or cannot be removed. */
export function removeFile(path: string): void {
  rmSync(path);
}

/* c8 ignore stop */

/** Recursively returns all file paths under `dir`. */
export async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : Promise.resolve([fullPath]);
    })
  );
  return nested.flat();
}
