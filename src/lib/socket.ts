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
    if (process.env.NODE_ENV === "development") {
      console.log("[Socket] Using NEXT_PUBLIC_SOCKET_URL:", url);
    }
    return url;
  }
  
  const origin = window.location.origin;
  if (process.env.NODE_ENV === "development") {
    console.log("[Socket] Using window.location.origin:", origin);
  }
  return origin;
}

export function getSocket(): Socket {
  if (!socket) {
    if (typeof window === "undefined") {
      throw new Error("Socket.IO cannot be initialized during SSR");
    }
    
    const url = getSocketUrl();
    const socketUrl = url || window.location.origin;
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Socket] Initializing connection to:", socketUrl);
    }
    
    const isVercel = socketUrl.includes("vercel.app") || socketUrl.includes("vercel.com");
    
    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: isVercel ? ["polling"] : ["polling", "websocket"],
      upgrade: !isVercel,
      forceNew: false,
    });
    
    socket.on("connect_error", (error: Error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[Socket] Connection error:", error.message);
      }
    });
    
    socket.on("connect", () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] ✅ Connected successfully");
      }
    });
    
    socket.on("disconnect", (reason) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Socket] Disconnected:", reason);
      }
    });
    
    socket.on("reconnect", () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] ✅ Reconnected");
      }
    });
    
    socket.on("reconnect_attempt", () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Reconnection attempt...");
      }
    });
    
    socket.on("reconnect_error", (error: Error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[Socket] Reconnection error:", error.message);
      }
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
