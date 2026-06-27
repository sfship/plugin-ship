/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

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

/** Writes a UTF-8 string to a file, appending a trailing newline if one is not already present. */
export function writeText(path: string, content: string): void {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

/** Appends a UTF-8 string to a file, creating it if it does not exist. */
export function appendText(path: string, content: string): void {
  appendFileSync(path, content, 'utf8');
}

/** Writes a value as pretty-printed JSON to a file. */
export function writeJson(path: string, data: unknown): void {
  writeText(path, JSON.stringify(data, null, 2));
}

/** Writes binary data to a file. */
export function writeBinary(path: string, data: Buffer): void {
  writeFileSync(path, data);
}

/** Removes a file. Throws if the file does not exist or cannot be removed. */
export function removeFile(path: string): void {
  rmSync(path);
}

/** Recursively removes a directory and its contents. No-op if it does not exist. */
export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

/** Canonicalizes a task or flow name into its registry key form: trimmed, lowercased, forward-slash separated, no leading slash. */
export function normalizePath(name: string): string {
  return name.trim().toLowerCase().replaceAll('\\', '/').replace(/^\/+/, '');
}

/* c8 ignore stop */

/** Returns true if the path exists and matches the given kind (`any`, `file`, or `dir`). */
export function pathExists(path: string, kind: 'any' | 'file' | 'dir'): boolean {
  if (kind === 'any') return existsSync(path);
  try {
    const stat = statSync(path);
    return kind === 'file' ? stat.isFile() : stat.isDirectory();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function collectFiles(dir: string, regex: RegExp, recursive: boolean, stripExt: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (recursive) {
        // eslint-disable-next-line no-await-in-loop
        results.push(...(await collectFiles(join(dir, entry.name), regex, recursive, stripExt)));
      }
    } else if (entry.isFile()) {
      const nameNoExt = basename(entry.name, extname(entry.name));
      if (regex.test(nameNoExt)) {
        results.push(stripExt ? nameNoExt : entry.name);
      }
    }
  }
  return results;
}

/** Finds files in `dir` whose names (without extension) match a glob pattern. */
export async function findFiles(
  dir: string,
  options: { pattern?: string; recursive?: boolean; stripExtension?: boolean } = {}
): Promise<string[]> {
  const { pattern = '*', recursive = true, stripExtension = true } = options;
  return collectFiles(dir, globToRegex(pattern), recursive, stripExtension);
}

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
