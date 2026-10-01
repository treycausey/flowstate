/**
 * Bookkeeping for async texture loads. A load takes a token when it starts and
 * may upload only if the token is still current when the decode resolves.
 * A token goes stale when the GL context is lost or restored (invalidate),
 * when the key is freed (cancel), or when a newer load for the key begins.
 */
export type LoadToken = { key: string; generation: number; seq: number }

export class TextureLoadTracker {
  private generation = 0
  private seq = 0
  private latest = new Map<string, number>()

  begin(key: string): LoadToken {
    const seq = ++this.seq
    this.latest.set(key, seq)
    return { key, generation: this.generation, seq }
  }

  isCurrent(token: LoadToken): boolean {
    return token.generation === this.generation && this.latest.get(token.key) === token.seq
  }

  /** Drop every in-flight load (context loss, restore, destroy). */
  invalidate() {
    this.generation++
    this.latest.clear()
  }

  /** Drop in-flight loads for one key (the texture was freed). */
  cancel(key: string) {
    this.latest.delete(key)
  }

  /** Drop in-flight loads whose key starts with the prefix. */
  cancelPrefix(prefix: string) {
    for (const key of [...this.latest.keys()]) if (key.startsWith(prefix)) this.latest.delete(key)
  }
}
