// ============================================================
// Rate Limiter — per-socket message throttle
//
// Sliding window: max N messages per time window.
// Prevents spam and abuse.
// ============================================================

interface RateEntry {
  timestamps: number[];
}

const MAX_MESSAGES = 30;
const WINDOW_MS = 10_000; // 10 seconds

class RateLimiter {
  private entries: Map<string, RateEntry> = new Map();

  /** Returns true if the action is allowed, false if rate limited */
  check(socketId: string): boolean {
    const now = Date.now();
    let entry = this.entries.get(socketId);

    if (!entry) {
      entry = { timestamps: [] };
      this.entries.set(socketId, entry);
    }

    // remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

    if (entry.timestamps.length >= MAX_MESSAGES) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /** Clean up when a socket disconnects */
  remove(socketId: string): void {
    this.entries.delete(socketId);
  }
}

export const rateLimiter = new RateLimiter();
