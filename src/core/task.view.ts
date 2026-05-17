import { StandardColors } from '@salesforce/sf-plugins-core';
import { Task } from './task.js';

/**
 * A consistent identity + description preview for a task. Used both when
 * running a task standalone (`ship task run`) and when describing it
 * (`ship task info`), so a task looks the same everywhere it appears.
 */
export function formatTaskPreview(task: Pick<Task, 'name' | 'description'>): string {
  const header = `${StandardColors.info('Task:')} ${StandardColors.success(task.name)}`;
  return task.description ? `${header}\n${task.description}` : header;
}
