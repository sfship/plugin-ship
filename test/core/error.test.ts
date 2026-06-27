/*
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
import { z } from 'zod';
import { asError, handleError, ExpectedError, formatZodError } from '../../src/core/error.js';

describe('asError', () => {
  it('returns thrown Errors as is', () => {
    const original = new Error('test');
    assert.equal(asError(original), original); // same instance
  });
  it('wraps a non-Error in a new Error', () => {
    assert.equal(asError('oops').message, 'oops');
  });
});

describe('handleError', () => {
  it('logs the message and exits for ExpectedError', () => {
    const logged: string[] = [];
    const original = process.exit.bind(process);
    process.exit = (() => {
      throw new Error('exit');
    }) as never;
    try {
      assert.throws(() => handleError(new ExpectedError('bad input'), (msg) => logged.push(msg)), /exit/);
      assert.deepEqual(logged, ['bad input']);
    } finally {
      process.exit = original as never;
    }
  });

  it('rethrows unexpected errors', () => {
    const original = new Error('crash');
    assert.throws(
      () => handleError(original, () => {}),
      (err) => err === original
    );
  });
});

describe('formatZodError', () => {
  it('formats a simple field error', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 42 });
    assert.ok(!result.success);
    assert.match(formatZodError(result.error), /name/);
  });

  it('formats a union error with one line per variant', () => {
    const schema = z.union([z.object({ github: z.string() }), z.object({ versionId: z.string() })]);
    const result = schema.safeParse({ unrelated: true });
    assert.ok(!result.success);
    const msg = formatZodError(result.error);
    assert.match(msg, /expected one of/);
    assert.match(msg, /github/);
    assert.match(msg, /versionId/);
  });

  it('uses (root) when a union error occurs at the root level', () => {
    const schema = z.union([z.string(), z.number()]);
    const result = schema.safeParse(null);
    assert.ok(!result.success);
    const msg = formatZodError(result.error);
    assert.match(msg, /\(root\)/);
  });
});
