/**
 * A key/value store for sharing state between tasks within a flow run.
 */
export class Store {
  private data: Map<string, unknown> = new Map();

  /**
   * Retrieves a value by key.
   *
   * @returns The stored value, or `undefined` if the key has not been set.
   */
  public get(key: string): unknown {
    return this.data.get(key);
  }

  /** Stores a value under the given key, overwriting any existing value. */
  public set(key: string, value: unknown): void {
    this.data.set(key, value);
  }
}
