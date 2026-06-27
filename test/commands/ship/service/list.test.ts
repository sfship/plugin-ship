import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';
import type { ServiceMeta } from '../../../../src/core/service.js';

let serviceMetas: ServiceMeta[] = [];

const ServiceList = await mockCommand('ship/service/list.js', {
  'service.js': {
    listMetas: () => serviceMetas,
  },
});

describe('ship service list', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;
  let uxStubs: ReturnType<typeof stubUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    uxStubs = stubUx($$.SANDBOX);
    serviceMetas = [];
  });

  it('shows the Connected Services header', async () => {
    await ServiceList.run([]);
    assert.ok(stubs.styledHeader.calledWith('Connected Services'));
  });

  it('shows a warning when no services are connected', async () => {
    await ServiceList.run([]);
    const warning = stubs.log.args.find(([a]) => String(a ?? '').includes('No services connected'));
    assert.ok(warning, 'expected a log call with the no-services warning');
  });

  it('shows the connect tip when no services are connected', async () => {
    await ServiceList.run([]);
    const tip = stubs.log.args.find(([a]) => String(a ?? '').includes('sf ship service connect'));
    assert.ok(tip, 'expected a log call with the connect tip');
  });

  it('renders the service table when services are present', async () => {
    serviceMetas = [{ service: 'github', account: 'acme', alias: 'default', scopes: ['repo'] }];
    await ServiceList.run([]);
    assert.ok(uxStubs.table.calledOnce);
  });

  it('shows the service info tip when services are present', async () => {
    serviceMetas = [{ service: 'github', account: 'acme', alias: 'default', scopes: ['repo'] }];
    await ServiceList.run([]);
    const tip = stubs.log.args.find(([a]) => String(a ?? '').includes('sf ship service info'));
    assert.ok(tip, 'expected a log call with the service info tip');
  });
});
