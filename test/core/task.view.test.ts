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
import { strict as assert } from 'node:assert';
import { formatTaskPreview } from '../../src/core/task.view.js';

describe('formatTaskPreview', () => {
  it('returns name only when description is absent', () => {
    const result = formatTaskPreview({ name: 'my-task' });
    assert.match(result, /my-task/);
    assert.doesNotMatch(result, /Description/);
  });

  it('includes description when present', () => {
    const result = formatTaskPreview({ name: 'my-task', description: 'does a thing' });
    assert.match(result, /my-task/);
    assert.match(result, /Description/);
    assert.match(result, /does a thing/);
  });
});
