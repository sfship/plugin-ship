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
import { resolve } from 'node:path';
import esmock from 'esmock';
import { ExpectedError } from '../../src/core/error.js';
import type { FlowRegistry as FlowRegistryClass } from '../../src/core/flow.registry.js';

type Module = { FlowRegistry: typeof FlowRegistryClass; builtinsDir: string };

const SHIP_DIR = '/ship';
const VALID_FLOW_YAML = 'steps:\n  my-step:\n    task: my-task\n';

const dirEntries = new Map<string, string[]>();
const fileContents = new Map<string, string>();

const { FlowRegistry, builtinsDir }: Module = await esmock('../../src/core/flow.registry.js', {
  '../../src/core/file.js': {
    listDir: (path: string) => {
      if (!dirEntries.has(path)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      return dirEntries.get(path)!;
    },
    readText: (path: string) => {
      const content = fileContents.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    normalizePath: (name: string) => name.trim().toLowerCase().replaceAll('\\', '/').replace(/^\/+/, ''),
  },
});

beforeEach(() => {
  dirEntries.clear();
  fileContents.clear();
});

function addBuiltinFlow(name: string, yaml = VALID_FLOW_YAML): void {
  const file = `${name}.yml`;
  dirEntries.set(builtinsDir, [...(dirEntries.get(builtinsDir) ?? []), file]);
  fileContents.set(resolve(builtinsDir, file), yaml);
}

function addShipFlow(name: string, yaml = VALID_FLOW_YAML): void {
  const file = `${name}.yml`;
  const dir = resolve(SHIP_DIR, 'flows');
  dirEntries.set(dir, [...(dirEntries.get(dir) ?? []), file]);
  fileContents.set(resolve(dir, file), yaml);
}

describe('FlowRegistry.list', () => {
  it('returns an empty array when no flows exist', () => {
    assert.deepEqual(new FlowRegistry(SHIP_DIR).list(), []);
  });

  it('returns sorted builtin flow names', () => {
    addBuiltinFlow('deploy/beta');
    addBuiltinFlow('ci');
    assert.deepEqual(new FlowRegistry(SHIP_DIR).list(), ['ci', 'deploy/beta']);
  });

  it('includes both builtin and ship-local flows', () => {
    addBuiltinFlow('ci');
    addShipFlow('my-custom-flow');
    const list = new FlowRegistry(SHIP_DIR).list();
    assert.ok(list.includes('ci'));
    assert.ok(list.includes('my-custom-flow'));
  });

  it('ship-local flows shadow builtins of the same name', () => {
    addBuiltinFlow('ci');
    addShipFlow('ci', 'steps:\n  ship-step:\n    task: ship-task\n');
    const registry = new FlowRegistry(SHIP_DIR);
    assert.equal(registry.list().filter((n) => n === 'ci').length, 1);
    assert.equal(registry.resolveFlow('ci').steps['ship-step']?.task, 'ship-task');
  });
});

describe('FlowRegistry.resolveFlow', () => {
  it('returns the flow definition by name', () => {
    addBuiltinFlow('ci');
    const flow = new FlowRegistry(SHIP_DIR).resolveFlow('ci');
    assert.ok(flow.steps['my-step']);
  });

  it('normalizes the flow name (case-insensitive)', () => {
    addBuiltinFlow('ci');
    assert.ok(new FlowRegistry(SHIP_DIR).resolveFlow('CI'));
  });

  it('throws ExpectedError for an unknown flow', () => {
    assert.throws(() => new FlowRegistry(SHIP_DIR).resolveFlow('missing'), ExpectedError);
  });
});

describe('FlowRegistry.builtinSource', () => {
  it('returns the absolute source path for a builtin flow', () => {
    addBuiltinFlow('ci');
    const source = new FlowRegistry(SHIP_DIR).builtinSource('ci');
    assert.equal(source, resolve(builtinsDir, 'ci.yml'));
  });

  it('returns null for a ship-only flow', () => {
    addShipFlow('custom');
    assert.equal(new FlowRegistry(SHIP_DIR).builtinSource('custom'), null);
  });

  it('returns null for an unknown flow name', () => {
    assert.equal(new FlowRegistry(SHIP_DIR).builtinSource('missing'), null);
  });
});

describe('FlowRegistry error handling', () => {
  it('throws ExpectedError when a flow file cannot be read', () => {
    dirEntries.set(builtinsDir, ['bad.yml']); // registered but no content → readText throws
    assert.throws(
      () => new FlowRegistry(SHIP_DIR),
      (err) => err instanceof ExpectedError && err.message.includes('Failed to load flow')
    );
  });

  it('throws ExpectedError when a flow file has an invalid schema', () => {
    addBuiltinFlow('bad', 'not-a-flow: true\n');
    assert.throws(
      () => new FlowRegistry(SHIP_DIR),
      (err) => err instanceof ExpectedError && err.message.includes('Invalid flow definition')
    );
  });
});
