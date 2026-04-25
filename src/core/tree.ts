type Tree = Map<string, Tree | null>;

function insert(tree: Tree, parts: string[]): void {
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    tree.set(head, null);
  } else {
    if (!tree.has(head)) tree.set(head, new Map());
    insert(tree.get(head) as Tree, rest);
  }
}

function renderLines(tree: Tree, prefix = ''): string[] {
  const lines: string[] = [];
  const entries = [...tree.entries()];
  for (const [i, [key, children]] of entries.entries()) {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    if (children === null) {
      lines.push(`${prefix}${connector}${key}`);
    } else {
      lines.push(`${prefix}${connector}${key}/`);
      lines.push(...renderLines(children, childPrefix));
    }
  }
  return lines;
}

/**
 * Renders a list of slash-separated paths as an ASCII tree.
 *
 * @param names - Sorted list of slash-separated path names.
 * @returns The tree as a single string ready to print.
 */
export function renderTree(names: string[]): string {
  const tree: Tree = new Map();
  for (const name of names) insert(tree, name.split('/'));
  return renderLines(tree).join('\n');
}
