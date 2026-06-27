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
import { renderTree } from '../../src/core/tree.js';

describe('renderTree', () => {
  it('renders a single flat entry', () => {
    assert.equal(renderTree(['ci']), '└── ci');
  });

  it('renders multiple flat entries', () => {
    assert.equal(renderTree(['ci', 'deploy']), '├── ci\n└── deploy');
  });

  it('renders a nested entry', () => {
    assert.equal(renderTree(['org/create/scratch']), '└── org/\n    └── create/\n        └── scratch');
  });

  it('renders siblings under the same parent', () => {
    const output = renderTree(['util/fails', 'util/log']);
    assert.equal(output, '└── util/\n    ├── fails\n    └── log');
  });

  it('uses ├── for non-last entries and └── for the last', () => {
    const output = renderTree(['a', 'b', 'c']);
    assert.ok(output.startsWith('├── a'));
    assert.ok(output.includes('├── b'));
    assert.ok(output.endsWith('└── c'));
  });

  it('renders │ continuation lines for non-last branches', () => {
    const output = renderTree(['apex/run/test', 'util/log']);
    assert.ok(output.includes('│'));
  });

  it('renders an empty list as an empty string', () => {
    assert.equal(renderTree([]), '');
  });

  it('renders a mixed flat and nested list', () => {
    const output = renderTree(['ci', 'test/hello']);
    assert.equal(output, '├── ci\n└── test/\n    └── hello');
  });

  it('handles a name that is also a prefix of another name', () => {
    const output = renderTree(['package/install', 'package/install/dependencies']);
    assert.equal(output, '└── package/\n    └── install/\n        └── dependencies');
  });
});
