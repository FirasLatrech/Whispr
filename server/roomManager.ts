// ============================================================
// Room Manager — in-memory room state
//
// Security:
//   - Max 2 users per room (1-on-1 private chat)
//   - HMAC-signed room tokens for join authorization
//   - Auto-expiry of idle rooms (1 hour)
//   - Room destruction on end-chat
// ============================================================

import { createHmac, randomBytes } from "crypto";

export interface RoomUser {
  socketId: string;
  name: string;
}

export interface Room {
  users: RoomUser[];
  token: string;
  createdAt: number;
  lastActivity: number;
}

const MAX_USERS = 2;
const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour

// server-side secret for HMAC signing — generated at boot, lives in memory only
const SERVER_SECRET = randomBytes(32).toString("hex");

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // sweep expired rooms every 5 minutes
    this.cleanupInterval = setInterval(() => this.sweep(), 5 * 60 * 1000);
  }

  /** Generate an HMAC token for a room ID */
  generateToken(roomId: string): string {
    return createHmac("sha256", SERVER_SECRET)
      .update(roomId)
      .digest("hex");
  }

  /** Verify a room token */
  verifyToken(roomId: string, token: string): boolean {
    const expected = this.generateToken(roomId);
    if (expected.length !== token.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return result === 0;
  }

  /** Create or join a room. Rejects if room already has 2 users. */
  createOrJoin(
    roomId: string,
    socketId: string,
    name: string
  ): { success: boolean; users: RoomUser[]; token: string } {
    let room = this.rooms.get(roomId);

    // first user — create room
    if (!room) {
      const serverToken = this.generateToken(roomId);
      room = {
        users: [{ socketId, name }],
        token: serverToken,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.rooms.set(roomId, room);
      return { success: true, users: room.users, token: serverToken };
    }

    // reconnect — same socket already in room
    const existing = room.users.find((u) => u.socketId === socketId);
    if (existing) {
      existing.name = name;
      room.lastActivity = Date.now();
      return { success: true, users: room.users, token: room.token };
    }

    // room full
    if (room.users.length >= MAX_USERS) {
      return { success: false, users: room.users, token: room.token };
    }

    room.users.push({ socketId, name });
    room.lastActivity = Date.now();
    return { success: true, users: room.users, token: room.token };
  }

  /** Record activity for rate limiting TTL reset */
  touch(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) room.lastActivity = Date.now();
  }

  /** Remove a user from their room */
  leave(socketId: string): { roomId: string; userName: string } | null {
    for (const [roomId, room] of this.rooms.entries()) {
      const idx = room.users.findIndex((u) => u.socketId === socketId);
      if (idx !== -1) {
        const user = room.users[idx];
        room.users.splice(idx, 1);
        if (room.users.length === 0) {
          this.rooms.delete(roomId);
        }
        return { roomId, userName: user.name };
      }
    }
    return null;
  }

  /** Destroy a room completely */
  destroyRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /** Check if a socket is a member of a room */
  isMember(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    return !!room?.users.find((u) => u.socketId === socketId);
  }

  /** Sweep expired rooms */
  private sweep(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        this.rooms.delete(roomId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const roomManager = new RoomManager();
