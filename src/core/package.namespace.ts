import { readFile, writeFile } from 'node:fs/promises';

/**
 * Replaces `%%%TOKEN%%%` placeholders in a file in-place.
 * Binary files (containing null bytes) are skipped.
 */
export async function replaceTokens(filePath: string, tokens: Record<string, string>): Promise<void> {
  const buf = await readFile(filePath);
  if (buf.includes(0)) return; // skip binary files
  let content = buf.toString('utf8');
  for (const [token, replacement] of Object.entries(tokens)) {
    content = content.replaceAll(`%%%${token}%%%`, replacement);
  }
  await writeFile(filePath, content, 'utf8');
}

/**
 * Builds the CCI namespace token map for use with {@link replaceTokens}.
 * Pass an empty string for unmanaged packages.
 */
export function buildTokenMap(namespace: string): Record<string, string> {
  return {
    NAMESPACE: namespace ? `${namespace}__` : '',
    NAMESPACE_DOT: namespace ? `${namespace}.` : '',
    NAMESPACE_OR_C: namespace || 'c',
  };
}
