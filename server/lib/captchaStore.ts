// ============================================================
// CAPTCHA Store — server-side challenge management
//
// In-memory store for SVG CAPTCHA challenges:
//   - create() generates a new challenge with 5-minute TTL
//   - verify() checks answer (case-insensitive, one-time use)
//   - Auto-sweeps expired challenges every 2 minutes
// ============================================================

import { randomBytes } from "crypto";
import svgCaptcha from "svg-captcha";

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

const CAPTCHA_TTL = 5 * 60 * 1000;     // 5 minutes
const SWEEP_INTERVAL = 2 * 60 * 1000;  // 2 minutes

class CaptchaStore {
  private store: Map<string, CaptchaEntry> = new Map();
  private sweepTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL);
    // allow process to exit without waiting for the timer
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  /** Generate a new CAPTCHA challenge. Returns { id, svg } — never exposes the answer. */
  create(): { id: string; svg: string } {
    const captcha = svgCaptcha.create({
      size: 5,
      noise: 3,
      color: false,
      inverse: true,         // light text for dark backgrounds
      width: 200,
      height: 60,
      fontSize: 48,
      ignoreChars: "0oO1lIi", // avoid ambiguous characters
      background: "transparent",
    });

    const id = randomBytes(16).toString("hex");

    this.store.set(id, {
      answer: captcha.text,
      expiresAt: Date.now() + CAPTCHA_TTL,
    });

    return { id, svg: captcha.data };
  }

  /** Verify a CAPTCHA answer. Case-insensitive, one-time use — deletes on check. */
  verify(id: string, answer: string): boolean {
    const entry = this.store.get(id);

    if (!entry) return false;

    // always delete — one-time use regardless of result
    this.store.delete(id);

    if (Date.now() > entry.expiresAt) return false;

    return entry.answer.toLowerCase() === answer.trim().toLowerCase();
  }

  /** Remove expired entries */
  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(id);
      }
    }
  }
}

export const captchaStore = new CaptchaStore();
