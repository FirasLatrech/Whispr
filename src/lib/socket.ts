"use client";

// ============================================================
// Socket.IO Client — singleton with reconnection config
// ============================================================

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  
  return window.location.origin;
}

export function getSocket(): Socket {
  if (!socket) {
    if (typeof window === "undefined") {
      throw new Error("Socket.IO cannot be initialized during SSR");
    }
    
    const url = getSocketUrl();
    const socketUrl = url || window.location.origin;
    
    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
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
