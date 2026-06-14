export async function withSuppressedStdout<T>(fn: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (): boolean => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = originalWrite;
  }
}
