import { getToken, setToken, getMeta } from '../service.js';
import type { ServiceMeta } from '../service.js';

const SERVICE = 'github';

/** Metadata for a stored GitHub credential. */
export type GithubMeta = ServiceMeta & {
  service: typeof SERVICE;
};

/**
 * Returns the stored GitHub access token for the given alias, or `undefined` if not connected.
 *
 * @param alias - The account alias to look up. Defaults to `'default'`.
 */
export function getGithubToken(alias = 'default'): string | undefined {
  return getToken(SERVICE, alias) ?? undefined;
}

/**
 * Persists a GitHub access token securely for the given alias.
 * The token is stored in the OS keychain; metadata is written alongside it.
 *
 * @param token - The GitHub OAuth access token to store.
 * @param username - The GitHub username associated with the token.
 * @param alias - The account alias to store under. Defaults to `'default'`.
 * @param scopes - The OAuth scopes granted to the token.
 */
export function setGithubToken(token: string, username: string, alias = 'default', scopes: string[] = []): void {
  setToken(SERVICE, username, alias, token, scopes);
}

/**
 * Returns the metadata for the stored GitHub credential for the given alias.
 *
 * @param alias - The account alias to look up. Defaults to `'default'`.
 */
export function getGithubMeta(alias = 'default'): GithubMeta | undefined {
  return getMeta(SERVICE, alias) as GithubMeta | undefined;
}
