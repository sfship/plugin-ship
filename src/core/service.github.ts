import { join } from 'node:path';
import { parse } from 'yaml';
import { ensureDir, writeBinary } from './file.js';
import { getToken, setToken } from './service.js';
import type { ServiceMeta } from './service.js';
import { ExpectedError } from './error.js';

const SERVICE = 'github';

// ---- Credential storage ------------------------------------------------------

/** Metadata for a stored GitHub credential. */
export type GithubMeta = ServiceMeta & { service: typeof SERVICE };

/** Returns the stored GitHub access token for the given alias, or `undefined` if not connected. */
export function getGithubToken(alias = 'default'): string | undefined {
  return getToken(SERVICE, alias) ?? undefined;
}

/**
 * Persists a GitHub access token securely for the given alias.
 * The token is stored in the OS keychain; metadata is written alongside it.
 */
export function setGithubToken(token: string, username: string, alias = 'default', scopes: string[] = []): void {
  setToken(SERVICE, username, alias, token, scopes);
}

// ---- URL utilities -----------------------------------------------------------

/** Normalises a GitHub reference to an `owner/repo` slug, accepting full URLs or slugs. */
export function normalizeRepo(github: string): string {
  return github.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
}

// ---- Internal ----------------------------------------------------------------

function githubHeaders(): Record<string, string> {
  const token = getGithubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ---- API types ---------------------------------------------------------------

/** A GitHub release with its associated tag name. */
export type Release = { tagName: string };

type GithubContentEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  download_url?: string | null;
};

/** Response from the GitHub device code endpoint. */
export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type TokenPollResponse = {
  access_token?: string;
  error?: string;
  interval?: number;
};

/** A GitHub user object. */
export type GithubUser = { login: string };

// ---- API helpers -------------------------------------------------------------

/**
 * Fetches a GitHub release for `repo`. Returns `null` if no release exists.
 * When `tag` is provided, fetches that specific release.
 * When `prerelease` is true, fetches the latest pre-release; otherwise fetches the latest production release.
 */
export async function fetchRelease(repo: string, tag?: string, prerelease = false): Promise<Release | null> {
  if (prerelease && !tag) {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
      headers: githubHeaders(),
    });
    if (!res.ok) return null;
    const releases = (await res.json()) as Array<{ tag_name: string; prerelease: boolean }>;
    const found = releases.find((r) => r.prerelease);
    return found ? { tagName: found.tag_name } : null;
  }
  const url = tag
    ? `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`
    : `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new ExpectedError(`Failed to fetch release for ${repo}: ${res.statusText}`);
  const data = (await res.json()) as { tag_name: string };
  return { tagName: data.tag_name };
}

/** Fetches raw file content from a GitHub repository at a specific ref. Returns `null` if the file does not exist. */
export async function fetchRaw(repo: string, ref: string, filename: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${filename}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ExpectedError(`Failed to fetch ${filename} from ${repo}@${ref}: ${res.statusText}`);
  return res.text();
}

/**
 * Fetches the annotated git tag object for `tagName` in `repo`.
 * Returns `null` for lightweight tags (no message) or if the tag does not exist.
 */
export async function fetchGitTag(repo: string, tagName: string): Promise<{ message: string } | null> {
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/tags/${encodeURIComponent(tagName)}`, {
    headers: githubHeaders(),
  });
  if (!refRes.ok) return null;
  const ref = (await refRes.json()) as { object: { type: string; sha: string } };
  if (ref.object.type !== 'tag') return null;

  const tagRes = await fetch(`https://api.github.com/repos/${repo}/git/tags/${ref.object.sha}`, {
    headers: githubHeaders(),
  });
  if (!tagRes.ok) return null;
  return (await tagRes.json()) as { message: string };
}

/** Basic metadata for a GitHub repository. */
export type GithubRepo = {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  open_issues_count: number;
  visibility: string;
};

/** Fetches basic repository metadata from the GitHub API using an explicit token. */
export async function fetchRepoInfo(repo: string, token: string): Promise<GithubRepo> {
  const resp = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) throw new ExpectedError(`GitHub API error: ${resp.status} ${resp.statusText}`);
  return (await resp.json()) as GithubRepo;
}

/**
 * Returns the package namespace declared in a CCI repo's `cumulusci.yml` at `ref`.
 * Returns an empty string if the file is missing or declares no namespace.
 */
export async function fetchCciNamespace(repo: string, ref: string): Promise<string> {
  const raw = await fetchRaw(repo, ref, 'cumulusci.yml');
  if (!raw) return '';
  const parsed = parse(raw) as { project?: { package?: { namespace?: string } } };
  return parsed?.project?.package?.namespace ?? '';
}

/**
 * Lists the immediate subdirectories of `path` in a GitHub repo at `ref`.
 * Returns an empty array if the path does not exist.
 */
export async function fetchSubdirs(repo: string, ref: string, path: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) throw new ExpectedError(`Failed to list ${path} in ${repo}@${ref}: ${res.statusText}`);
  const entries = (await res.json()) as Array<{ name: string; type: string }>;
  return entries.filter((e) => e.type === 'dir').map((e) => `${path}/${e.name}`);
}

/** Downloads a GitHub repository directory at `ref` into `localDir`, recursing into subdirectories. */
export async function downloadDir(repo: string, ref: string, remotePath: string, localDir: string): Promise<void> {
  const url = `https://api.github.com/repos/${repo}/contents/${remotePath}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) throw new ExpectedError(`Failed to fetch ${remotePath} from ${repo}@${ref}: ${res.statusText}`);
  const entries = (await res.json()) as GithubContentEntry[];

  ensureDir(localDir);

  await Promise.all(
    entries.map(async (entry) => {
      const entryLocal = join(localDir, entry.name);
      if (entry.type === 'dir') {
        await downloadDir(repo, ref, entry.path, entryLocal);
      } else {
        let buf: Buffer;
        if (entry.content && entry.encoding === 'base64') {
          buf = Buffer.from(entry.content.replace(/\n/g, ''), 'base64');
        } else if (entry.download_url) {
          const fileRes = await fetch(entry.download_url, { headers: githubHeaders() });
          buf = Buffer.from(await fileRes.arrayBuffer());
        } else {
          throw new ExpectedError(`Cannot download ${entry.path}: no content or download_url available`);
        }
        writeBinary(entryLocal, buf);
      }
    })
  );
}

// ---- OAuth device flow -------------------------------------------------------

const CLIENT_ID = 'Ov23liy9NAepXOSybR7K';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const SCOPE = 'repo';

/** Initiates the GitHub OAuth device flow and returns the device code response. */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const resp = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    // eslint-disable-next-line camelcase
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });
  return resp.json() as Promise<DeviceCodeResponse>;
}

/** Polls the GitHub token endpoint until the user authorizes the device or an error occurs. */
export async function pollForToken(deviceCode: string, interval: number): Promise<string> {
  await new Promise<void>((res) => setTimeout(res, interval));
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // eslint-disable-next-line camelcase
      client_id: CLIENT_ID,
      // eslint-disable-next-line camelcase
      device_code: deviceCode,
      // eslint-disable-next-line camelcase
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  const data = (await resp.json()) as TokenPollResponse;
  if (data.access_token) return data.access_token;
  // c8 ignore next — slow_down retry delay is always ≥5 s; testing would block the suite
  if (data.error === 'slow_down') return pollForToken(deviceCode, ((data.interval ?? interval) / 1000 + 5) * 1000);
  if (data.error === 'authorization_pending') return pollForToken(deviceCode, interval);
  throw new ExpectedError(`GitHub authorization failed: ${data.error ?? 'unknown error'}`);
}
