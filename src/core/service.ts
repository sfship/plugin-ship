import { join } from 'node:path';
import { homedir } from 'node:os';
import { Entry } from '@napi-rs/keyring';
import { ensureDir, listDir, readJson, writeJson, removeFile } from './file.js';

const KEYRING_SERVICE = 'plugin-ship';

/** Metadata stored alongside a credential, describing the account and granted scopes. */
export type ServiceMeta = {
  service: string;
  account: string;
  alias: string;
  scopes: string[];
};

/** Returns the path to the plugin-ship services directory, creating it if needed. */
function getServicesDir(): string {
  const dir = join(homedir(), '.sf', 'plugin-ship', 'services');
  ensureDir(dir);
  return dir;
}

function metaFilePath(service: string, account: string, alias: string): string {
  return join(getServicesDir(), `${service}-${account}-${alias}.meta.json`);
}

/**
 * Retrieves the stored token for a service alias from the OS keychain.
 *
 * @param service - The external service name (e.g. `'github.com'`).
 * @param alias - The account alias (e.g. `'default'`).
 * @returns The stored token, or `null` if not found.
 */
export function getToken(service: string, alias: string): string | null {
  return new Entry(KEYRING_SERVICE, `${service}:${alias}`).getPassword() ?? null;
}

/**
 * Stores a token in the OS keychain and writes a metadata file alongside it.
 *
 * @param service - The external service name (e.g. `'github.com'`).
 * @param account - The account identifier (e.g. GitHub username).
 * @param alias - The account alias (e.g. `'default'`).
 * @param token - The credential to store.
 * @param scopes - The scopes or permissions granted to this credential.
 */
export function setToken(service: string, account: string, alias: string, token: string, scopes: string[] = []): void {
  new Entry(KEYRING_SERVICE, `${service}:${alias}`).setPassword(token);
  writeJson(metaFilePath(service, account, alias), { service, account, alias, scopes } satisfies ServiceMeta);
}

/**
 * Reads the metadata for a stored credential by alias.
 *
 * @param service - The external service name.
 * @param alias - The account alias to look up.
 * @returns The metadata, or `undefined` if no credential is stored for this alias.
 */
export function getMeta(service: string, alias: string): ServiceMeta | undefined {
  const dir = getServicesDir();
  const file = listDir(dir).find((f) => f.startsWith(`${service}-`) && f.endsWith(`-${alias}.meta.json`));
  if (!file) return undefined;
  return readJson<ServiceMeta>(join(dir, file));
}

/**
 * Returns metadata for all stored credentials.
 */
export function listMetas(): ServiceMeta[] {
  const dir = getServicesDir();
  return listDir(dir)
    .filter((f) => f.endsWith('.meta.json'))
    .map((f) => readJson<ServiceMeta>(join(dir, f)));
}

/**
 * Removes a stored credential from the OS keychain and deletes its metadata file.
 *
 * @param service - The external service name.
 * @param account - The account identifier.
 * @param alias - The account alias.
 */
export function deleteToken(service: string, account: string, alias: string): void {
  new Entry(KEYRING_SERVICE, `${service}:${alias}`).deletePassword();
  try {
    removeFile(metaFilePath(service, account, alias));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
