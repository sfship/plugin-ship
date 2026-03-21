import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { type KeyStorage, encrypt, decrypt, metaFilePath, getShipServicesDir, getKeyStorage } from '../crypto.js';

const SERVICE = 'github.com';

type GithubMeta = {
  service: string;
  account: string;
  alias: string;
  scopes: string[];
  keyStorage: KeyStorage;
  keyFile: string | null;
  token: string;
};

/** Reads the metadata file for the given alias, or `undefined` if not found. */
function getMeta(alias: string): GithubMeta | undefined {
  const dir = getShipServicesDir();
  const file = readdirSync(dir).find((f) => f.startsWith(`${SERVICE}-`) && f.endsWith(`-${alias}.meta.json`));
  if (!file) return undefined;
  return JSON.parse(readFileSync(join(dir, file), 'utf8')) as GithubMeta;
}

/**
 * Returns the stored GitHub access token for the given alias, or `undefined` if not connected.
 *
 * @param alias - The account alias to look up. Defaults to `'default'`.
 */
export function getGithubToken(alias = 'default'): string | undefined {
  const meta = getMeta(alias);
  if (!meta) return undefined;
  return decrypt(meta.token, meta.keyStorage, SERVICE, meta.account, alias);
}

/**
 * Persists a GitHub access token securely for the given alias. The token is encrypted
 * with AES-256-GCM before being written to disk, with the key stored in the OS keychain.
 *
 * @param token - The GitHub OAuth access token to store.
 * @param username - The GitHub username associated with the token.
 * @param alias - The account alias to store under. Defaults to `'default'`.
 * @param scopes - The OAuth scopes granted to the token.
 */
export function setGithubToken(token: string, username: string, alias = 'default', scopes: string[] = []): void {
  const keyStorage = getKeyStorage();
  const keyFile = keyStorage === 'file' ? join(getShipServicesDir(), `${SERVICE}-${username}-${alias}.key.json`) : null;
  const meta: GithubMeta = {
    service: SERVICE,
    account: username,
    alias,
    scopes,
    keyStorage,
    keyFile,
    token: encrypt(token, keyStorage, SERVICE, username, alias),
  };
  writeFileSync(metaFilePath(SERVICE, username, alias), JSON.stringify(meta, null, 2));
}
