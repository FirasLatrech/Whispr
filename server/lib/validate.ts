// ============================================================
// Server-side validation helpers
//
// Every socket event payload is validated before processing.
// Rejects malformed, oversized, or malicious input.
// ============================================================

const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{4,16}$/;
const NAME_MAX = 24;
const TEXT_MAX = 4000;
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB

export function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === "string" && ROOM_ID_REGEX.test(roomId);
}

export function isValidName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.trim().length >= 1 &&
    name.trim().length <= NAME_MAX
  );
}

export function isValidText(text: unknown): text is string {
  return typeof text === "string" && text.length <= TEXT_MAX;
}

export function isValidMessageType(type: unknown): type is "text" | "image" | "voice" | "gif" {
  return type === "text" || type === "image" || type === "voice" || type === "gif";
}

export function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export function isValidBase64(data: unknown): data is string {
  if (typeof data !== "string") return false;
  if (data.length > MAX_PAYLOAD_SIZE) return false;
  return true;
}

export function isValidTimestamp(ts: unknown): ts is number {
  if (typeof ts !== "number") return false;
  const now = Date.now();
  // reject timestamps more than 30 seconds in the future or 5 minutes in the past
  return ts > now - 300_000 && ts < now + 30_000;
}

/** Sanitize a display name — strip control chars, trim */
export function sanitizeName(name: string): string {
  return name.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, NAME_MAX);
}
