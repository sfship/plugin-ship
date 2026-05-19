import { StandardColors } from '@salesforce/sf-plugins-core';
import { Task } from './task.js';

/**
 * UX formatted Task name + description
 */
export function formatTaskPreview(task: Pick<Task, 'name' | 'description'>): string {
  const header = `${StandardColors.info('Task:')} ${StandardColors.success(task.name)}`;
  return task.description ? `${header}\n${StandardColors.info('Description:')} ${task.description}` : header;
}
