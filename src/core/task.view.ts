import { StandardColors } from '@salesforce/sf-plugins-core';
import { Task } from './task.definition.schema.js';

/**
 * Returns a UX-formatted string with the task name and, if present, its description.
 *
 * @param task - Object containing the task `name` and optional `description`.
 * @returns Formatted string with colorized label and value pairs.
 */
export function formatTaskPreview(task: Pick<Task, 'name' | 'description'>): string {
  const header = `${StandardColors.info('Task:')} ${StandardColors.success(task.name)}`;
  return task.description ? `${header}\n${StandardColors.info('Description:')} ${task.description}` : header;
}
