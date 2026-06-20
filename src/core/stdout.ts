export async function withSuppressedStdout<T>(fn: () => Promise<T>): Promise<T> {
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (): boolean => true;
  process.stderr.write = (): boolean => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
}
