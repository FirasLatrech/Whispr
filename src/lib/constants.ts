// ============================================================
// Application constants — single source of truth
// ============================================================

export const CONFIG = {
  /** Maximum users per chat room */
  MAX_ROOM_SIZE: 2,

  /** Room auto-destroy after inactivity (ms) — 1 hour */
  ROOM_TTL_MS: 60 * 60 * 1000,

  /** IndexedDB message expiry (ms) — 24 hours */
  MESSAGE_TTL_MS: 24 * 60 * 60 * 1000,

  /** Maximum message payload size (bytes) — 5MB */
  MAX_MESSAGE_SIZE: 5 * 1024 * 1024,

  /** Socket.IO max HTTP buffer size (bytes) — 6MB (overhead margin) */
  MAX_HTTP_BUFFER: 6 * 1024 * 1024,

  /** Rate limit: max messages per window */
  RATE_LIMIT_MAX: 30,

  /** Rate limit: window duration (ms) — 10 seconds */
  RATE_LIMIT_WINDOW_MS: 10_000,

  /** Max connections per IP address */
  MAX_CONNECTIONS_PER_IP: 5,

  /** Room ID length (nanoid) */
  ROOM_ID_LENGTH: 8,

  /** Display name constraints */
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 24,

  /** Text message max length */
  TEXT_MAX_LENGTH: 4000,

  /** Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"] as readonly string[],

  /** Image compression settings */
  IMAGE_MAX_WIDTH: 800,
  IMAGE_QUALITY: 0.7,

  /** IndexedDB database name */
  DB_NAME: "whispr-db",
  DB_VERSION: 1,
} as const;
