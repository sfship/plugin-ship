/*
 * Copyright 2026, Salesforce, Inc.
 *
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
type Tree = Map<string, Tree | null>;

function insert(tree: Tree, parts: string[]): void {
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    if (!tree.has(head)) tree.set(head, null);
  } else {
    if (!tree.has(head) || tree.get(head) === null) tree.set(head, new Map());
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
