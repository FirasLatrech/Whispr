"use client";

// ============================================================
// Socket.IO Client — singleton with reconnection config
// ============================================================

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (envUrl && envUrl.trim()) {
    const url = envUrl.trim();
    console.log("[Socket] Using NEXT_PUBLIC_SOCKET_URL:", url);
    return url;
  }
  
  const origin = window.location.origin;
  console.log("[Socket] Using window.location.origin:", origin);
  return origin;
}

export function getSocket(): Socket {
  if (!socket) {
    if (typeof window === "undefined") {
      throw new Error("Socket.IO cannot be initialized during SSR");
    }
    
    const url = getSocketUrl();
    const socketUrl = url || window.location.origin;
    
    console.log("[Socket] Initializing connection to:", socketUrl);
    
    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket", "polling"],
      forceNew: false,
    });
    
    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      console.error("[Socket] Error type:", error.type);
      console.error("[Socket] Error description:", error.description);
    });
    
    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected successfully to:", socketUrl);
    });
    
    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      if (reason === "io server disconnect") {
        console.warn("[Socket] Server disconnected the socket");
      } else if (reason === "io client disconnect") {
        console.warn("[Socket] Client disconnected");
      } else {
        console.warn("[Socket] Connection lost, will attempt to reconnect");
      }
    });
    
    socket.on("reconnect", (attemptNumber) => {
      console.log("[Socket] ✅ Reconnected after", attemptNumber, "attempts");
    });
    
    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("[Socket] Reconnection attempt", attemptNumber);
    });
    
    socket.on("reconnect_error", (error) => {
      console.error("[Socket] Reconnection error:", error.message);
    });
    
    socket.on("reconnect_failed", () => {
      console.error("[Socket] ❌ Reconnection failed after all attempts");
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
