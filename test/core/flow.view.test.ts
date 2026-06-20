import { strict as assert } from 'node:assert';
import { formatFlowPreview, formatFlowPlan, formatFlowSummary, type FlowOutcome } from '../../src/core/flow.view.js';

describe('formatFlowPreview', () => {
  it('returns flow name only when description is absent', () => {
    const result = formatFlowPreview('deploy/beta');
    assert.match(result, /deploy\/beta/);
    assert.doesNotMatch(result, /Description/);
  });

  it('includes description when present', () => {
    const result = formatFlowPreview('deploy/beta', 'Builds and deploys a beta package');
    assert.match(result, /deploy\/beta/);
    assert.match(result, /Description/);
    assert.match(result, /Builds and deploys a beta package/);
  });
});

describe('formatFlowPlan', () => {
  it('lists steps without annotation tags for a plain step', () => {
    const result = formatFlowPlan('my-flow', [['deploy', { task: 'sf/deploy' }]], []);
    assert.match(result, /my-flow/);
    assert.match(result, /deploy/);
    assert.doesNotMatch(result, /\[(?:if|if-not|ignore-failure)/);
  });

  it('appends [if] when a step has an if condition', () => {
    const result = formatFlowPlan('my-flow', [['deploy', { task: 'sf/deploy', if: { value: 'x' } }]], []);
    assert.match(result, /\[if\]/);
  });

  it('appends [if-not] when a step has an if-not condition', () => {
    const result = formatFlowPlan('my-flow', [['deploy', { task: 'sf/deploy', 'if-not': { value: 'x' } }]], []);
    assert.match(result, /\[if-not\]/);
  });

  it('appends [ignore-failure] when a step has ignore-failure', () => {
    const result = formatFlowPlan('my-flow', [['deploy', { task: 'sf/deploy', 'ignore-failure': true }]], []);
    assert.match(result, /\[ignore-failure\]/);
  });

  it('includes a Finally section when finally steps are provided', () => {
    const result = formatFlowPlan('my-flow', [['build', { task: 'sf/build' }]], [['cleanup', { task: 'sf/cleanup' }]]);
    assert.match(result, /Finally/);
    assert.match(result, /cleanup/);
  });
});

describe('formatFlowSummary', () => {
  function makeOutcome(overrides: Partial<FlowOutcome> = {}): FlowOutcome {
    return {
      completed: new Set(),
      failed: new Set(),
      skipped: new Set(),
      ignored: new Map(),
      ...overrides,
    };
  }

  it('marks a skipped step with a skipped indicator', () => {
    const result = formatFlowSummary(
      [['my-step', { task: 'noop' }]],
      [],
      makeOutcome({ skipped: new Set(['my-step']) })
    );
    assert.match(result, /skipped/);
  });
});
