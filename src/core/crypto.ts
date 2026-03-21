import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { spawnSync } from 'node:child_process';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export type KeyStorage = 'keychain' | 'secret-tool' | 'file';

/** Returns the storage mechanism used on the current platform. */
export function getKeyStorage(): KeyStorage {
  if (platform() === 'darwin') return 'keychain';
  if (platform() === 'linux') return 'secret-tool';
  return 'file';
}

/** Returns the path to the plugin-ship services directory, creating it if needed. */
export function getShipServicesDir(): string {
  const dir = join(homedir(), '.sf', 'plugin-ship', 'services');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const keyFilePath = (service: string, account: string, alias: string): string =>
  join(getShipServicesDir(), `${service}-${account}-${alias}.key.json`);

export const metaFilePath = (service: string, account: string, alias: string): string =>
  join(getShipServicesDir(), `${service}-${account}-${alias}.meta.json`);

/** Retrieves the encryption key using the storage method recorded in the meta file. */
function getKeyFromStorage(keyStorage: KeyStorage, service: string, account: string, alias: string): string | null {
  if (keyStorage === 'keychain') {
    const result = spawnSync('/usr/bin/security', ['find-generic-password', '-a', account, '-s', service, '-w']);
    return result.status === 0 ? result.stdout.toString().trim() : null;
  }

  if (keyStorage === 'secret-tool') {
    const result = spawnSync('/usr/bin/secret-tool', ['lookup', 'user', account, 'domain', service]);
    return result.status === 0 ? result.stdout.toString().trim() : null;
  }

  const file = keyFilePath(service, account, alias);
  if (existsSync(file)) {
    const contents = JSON.parse(readFileSync(file, 'utf8')) as { key: string };
    return contents.key;
  }

  return null;
}

/** Stores the encryption key using the current platform's storage mechanism. */
function setKeyInStorage(keyStorage: KeyStorage, service: string, account: string, alias: string, key: string): void {
  if (keyStorage === 'keychain') {
    spawnSync('/usr/bin/security', ['add-generic-password', '-a', account, '-s', service, '-w', key, '-U']);
    return;
  }

  if (keyStorage === 'secret-tool') {
    spawnSync('/usr/bin/secret-tool', ['store', "--label='plugin-ship'", 'user', account, 'domain', service], {
      input: key,
    });
    return;
  }

  writeFileSync(keyFilePath(service, account, alias), JSON.stringify({ key }, null, 2));
}

/** Returns the existing key, or generates and stores a new one. */
export function getOrCreateKey(keyStorage: KeyStorage, service: string, account: string, alias: string): string {
  const existing = getKeyFromStorage(keyStorage, service, account, alias);
  if (existing) return existing;
  const key = randomBytes(KEY_BYTES).toString('hex');
  setKeyInStorage(keyStorage, service, account, alias, key);
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param text - The plaintext to encrypt.
 * @param keyStorage - Where the key is stored.
 * @param service - The external service name (e.g. `'github.com'`).
 * @param account - The account identifier (e.g. GitHub username).
 * @param alias - The user-facing alias for this account (e.g. `'default'`, `'work'`).
 */
export function encrypt(text: string, keyStorage: KeyStorage, service: string, account: string, alias: string): string {
  const key = getOrCreateKey(keyStorage, service, account, alias);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}${encrypted}:${tag}`;
}

/**
 * Decrypts a string previously encrypted by {@link encrypt}.
 *
 * @param text - The encrypted string.
 * @param keyStorage - Where the key is stored.
 * @param service - The external service name (e.g. `'github.com'`).
 * @param account - The account identifier (e.g. GitHub username).
 * @param alias - The user-facing alias for this account (e.g. `'default'`, `'work'`).
 */
export function decrypt(text: string, keyStorage: KeyStorage, service: string, account: string, alias: string): string {
  const key = getOrCreateKey(keyStorage, service, account, alias);
  const colonIndex = text.lastIndexOf(':');
  const ivAndData = text.substring(0, colonIndex);
  const tag = text.substring(colonIndex + 1);
  const iv = ivAndData.substring(0, IV_BYTES * 2);
  const data = ivAndData.substring(IV_BYTES * 2);
  const decipher = createDecipheriv(ALGO, Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return `${decipher.update(data, 'hex', 'utf8')}${decipher.final('utf8')}`;
}
