import { Org } from '@salesforce/core';
import { ExpectedError } from './util.error.js';

type InstallStatus = 'SUCCESS' | 'ERROR' | 'IN_PROGRESS' | 'UNKNOWN';

type PackageInstallRequest = {
  Id: string;
  Status: InstallStatus;
  Errors?: { errors: Array<{ message: string }> };
};

const POLL_INTERVAL_MS = 5000;

/**
 * Installs a package version into `org` by its 04t ID.
 * Polls until the install succeeds, fails, or `waitMinutes` elapses.
 */
export async function installPackageVersion(
  org: Org,
  versionId: string,
  opts: { waitMinutes?: number; log: (msg: string) => void }
): Promise<void> {
  const { waitMinutes = 10, log } = opts;
  const timeoutMs = waitMinutes * 60 * 1000;
  const conn = org.getConnection();

  log(`Installing ${versionId}...`);

  const created = (await conn.tooling.create('PackageInstallRequest', {
    SubscriberPackageVersionKey: versionId,
    EnableRss: true,
    SecurityType: 'None',
    UpgradeType: 'mixed-mode',
    NameConflictResolution: 'Block',
  })) as { id: string; success: boolean };

  if (!created.success) {
    throw new ExpectedError(`Failed to submit install request for ${versionId}`);
  }

  const startMs = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    // eslint-disable-next-line no-await-in-loop
    const record = (await conn.tooling.retrieve('PackageInstallRequest', created.id)) as PackageInstallRequest;

    if (record.Status === 'SUCCESS') {
      log(`Installed ${versionId}.`);
      return;
    }

    if (record.Status === 'ERROR') {
      const messages = (record.Errors?.errors ?? []).map((e) => e.message).join('; ');
      throw new ExpectedError(`Package install failed for ${versionId}: ${messages}`);
    }

    if (Date.now() - startMs >= timeoutMs) {
      throw new ExpectedError(`Package install timed out after ${waitMinutes} minute(s) for ${versionId}`);
    }

    log(`Still installing... (${record.Status})`);
  }
}
