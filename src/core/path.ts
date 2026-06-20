/**
 * Canonicalizes a task or flow name into its registry key form, shared by the
 * task and flow registries so a name resolves identically however it's typed.
 *
 * Trims whitespace, lowercases (so resolution matches on both case-sensitive and
 * case-insensitive filesystems), accepts OS-native separators (`\` → `/`), and
 * tolerates a leading slash (users tend to type `/ci`). Keys are slash-separated,
 * lowercase, with no leading slash.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replaceAll('\\', '/').replace(/^\/+/, '');
}
