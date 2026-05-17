import { StandardColors } from '@salesforce/sf-plugins-core';
import { Task } from './task.js';

/**
 * A consistent identity + description block for a task, shared by
 * `ship task run` and `ship task info` so a task presents the same way
 * everywhere. Plain text, not a `styledHeader` — an identity title is not a
 * section header.
 */
export function formatTaskPreview(task: Pick<Task, 'name' | 'description'>): string {
  const header = `${StandardColors.info('Task:')} ${StandardColors.success(task.name)}`;
  return task.description ? `${header}\n${task.description}` : header;
}
