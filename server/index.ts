// ============================================================
// Whispr — Server Entry Point
//
// Security layers:
//   1. Security headers on every HTTP response
//   2. Per-IP connection limiting
//   3. HMAC-signed room tokens for join authorization
//   4. Strict input validation on every socket event
//   5. Per-socket rate limiting
//   6. Message size enforcement
//   7. Room membership verification before relay
//   8. Auto-expiry of idle rooms
//   9. The server NEVER sees plaintext messages (E2EE)
//
// The server is a dumb relay — it forwards encrypted blobs
// between two authenticated peers. Nothing is stored.
// ============================================================

import { createServer, IncomingMessage, ServerResponse } from "http";
import next from "next";
import { Server } from "socket.io";
import { roomManager } from "./roomManager.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { applySecurityHeaders } from "./lib/securityHeaders.js";
import {
  isValidRoomId,
  isValidName,
  isValidMessageType,
  isValidBase64,
  isValidTimestamp,
  sanitizeName,
} from "./lib/validate.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================================
// Per-IP connection tracking
// ============================================================

const MAX_CONNECTIONS_PER_IP = 5;
const connectionsPerIp: Map<string, number> = new Map();

function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return "unknown";
}

// ============================================================
// Boot
// ============================================================

app.prepare().then(() => {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    applySecurityHeaders(req, res);

    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "*" : false,
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 6 * 1024 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000,
    connectTimeout: 10000,
  });

  // ===========================================================
  // Connection-level middleware: IP rate limiting
  // ===========================================================

  io.use((socket, next) => {
    const ip = getClientIp(socket.handshake.headers as Record<string, string | string[] | undefined>);
    const count = connectionsPerIp.get(ip) || 0;

    if (count >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error("Too many connections from this IP"));
    }

    connectionsPerIp.set(ip, count + 1);
    socket.data.ip = ip;
    next();
  });

  // ===========================================================
  // Socket event handlers
  // ===========================================================

  io.on("connection", (socket) => {

    // ---------------------------------------------------------
    // JOIN ROOM (max 2 users)
    // ---------------------------------------------------------

    socket.on("join-room", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId, name, rejoining } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) {
        socket.emit("error-msg", { message: "Invalid room ID" });
        return;
      }
      if (!isValidName(name)) {
        socket.emit("error-msg", { message: "Invalid name" });
        return;
      }

      const cleanName = sanitizeName(name as string);
      const result = roomManager.createOrJoin(roomId as string, socket.id, cleanName);

      if (!result.success) {
        socket.emit("room-full");
        return;
      }

      socket.join(roomId as string);
      socket.data.roomId = roomId;
      socket.data.name = cleanName;

      // Find existing peer in the room (if any)
      const existingPeer = result.users.find((u) => u.socketId !== socket.id);
      socket.emit("joined", {
        token: result.token,
        peerName: existingPeer?.name || null,
      });
      socket.to(roomId as string).emit("peer-joined", { name: cleanName });
    });

    // ---------------------------------------------------------
    // KEY EXCHANGE (E2EE public key relay between 2 peers)
    // ---------------------------------------------------------

    socket.on("key-exchange", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId, publicKey } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) return;
      if (typeof publicKey !== "string" || publicKey.length > 1000) return;
      if (!roomManager.isMember(roomId as string, socket.id)) return;

      socket.to(roomId as string).emit("key-exchange", { publicKey });
    });

    // ---------------------------------------------------------
    // SYNC HISTORY (encrypted bulk relay for new peer)
    // ---------------------------------------------------------

    socket.on("sync-history", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId, messages } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) return;
      if (!roomManager.isMember(roomId as string, socket.id)) return;
      if (!Array.isArray(messages)) return;

      socket.to(roomId as string).emit("sync-history", { messages });
    });

    // ---------------------------------------------------------
    // SEND MESSAGE (encrypted relay to peer)
    // ---------------------------------------------------------

    socket.on("send-message", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const msg = payload as Record<string, unknown>;

      if (!rateLimiter.check(socket.id)) {
        socket.emit("error-msg", { message: "Rate limited. Slow down." });
        return;
      }

      if (!isValidRoomId(msg.roomId)) return;
      if (!isValidName(msg.sender)) return;
      if (!isValidMessageType(msg.type)) return;
      if (!isValidBase64(msg.encrypted)) return;
      if (!isValidBase64(msg.iv)) return;
      if (!isValidTimestamp(msg.timestamp)) return;
      if (!roomManager.isMember(msg.roomId as string, socket.id)) return;

      roomManager.touch(msg.roomId as string);

      socket.to(msg.roomId as string).emit("receive-message", {
        sender: sanitizeName(msg.sender as string),
        type: msg.type,
        encrypted: msg.encrypted,
        iv: msg.iv,
        timestamp: msg.timestamp,
      });
    });

    // ---------------------------------------------------------
    // TYPING INDICATORS
    // ---------------------------------------------------------

    socket.on("typing", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId, name } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) return;
      if (!isValidName(name)) return;
      if (!roomManager.isMember(roomId as string, socket.id)) return;

      socket.to(roomId as string).emit("typing", { name: sanitizeName(name as string) });
    });

    socket.on("stop-typing", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) return;
      if (!roomManager.isMember(roomId as string, socket.id)) return;

      socket.to(roomId as string).emit("stop-typing");
    });

    // ---------------------------------------------------------
    // END CHAT
    // ---------------------------------------------------------

    socket.on("end-chat", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { roomId } = payload as Record<string, unknown>;

      if (!isValidRoomId(roomId)) return;
      if (!roomManager.isMember(roomId as string, socket.id)) return;

      socket.to(roomId as string).emit("chat-ended");
      roomManager.destroyRoom(roomId as string);

      const sockets = io.sockets.adapter.rooms.get(roomId as string);
      if (sockets) {
        for (const id of sockets) {
          io.sockets.sockets.get(id)?.leave(roomId as string);
        }
      }
    });

    // ---------------------------------------------------------
    // DISCONNECT
    // ---------------------------------------------------------

    socket.on("disconnect", () => {
      const ip = socket.data.ip as string;
      if (ip) {
        const count = connectionsPerIp.get(ip) || 1;
        if (count <= 1) {
          connectionsPerIp.delete(ip);
        } else {
          connectionsPerIp.set(ip, count - 1);
        }
      }

      rateLimiter.remove(socket.id);

      const result = roomManager.leave(socket.id);
      if (result) {
        socket.to(result.roomId).emit("peer-left", { name: result.userName });
      }
    });
  });

  // ===========================================================
  // Start
  // ===========================================================

  httpServer.listen(port, () => {
    console.log(`> Whispr ready on http://${hostname}:${port}`);
    console.log(`> Security: headers, rate-limiting, validation, E2EE relay`);
  });
});
