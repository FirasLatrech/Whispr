"use client";

// ============================================================
// useSocket — Socket.IO connection + E2EE key exchange
//
// Manages:
//   - Socket connection lifecycle
//   - Room join/leave (max 2 users)
//   - ECDH public key exchange with peer
//   - Shared key derivation
//   - Peer status tracking
//   - Typing indicators
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
} from "@/lib/crypto";
import type { Socket } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState(false);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [isFirstUser, setIsFirstUser] = useState(false);

  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const keySentRef = useRef(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setConnecting(true);
    setConnectionError(null);
    
    let s: Socket;
    try {
      s = getSocket();
      socketRef.current = s;
      
      connectionTimeoutRef.current = setTimeout(() => {
        if (!s.connected) {
          console.error("[useSocket] Connection timeout after 20 seconds");
          setConnectionError("Connection timeout. Please check your network and try again.");
          setConnecting(false);
          setConnected(false);
        }
      }, 20000);
      
      s.connect();
    } catch (error) {
      console.error("[useSocket] Failed to initialize socket:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to initialize socket");
      setConnecting(false);
      setConnected(false);
      return;
    }

    s.on("connect", () => {
      console.log("[useSocket] ✅ Socket connected");
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setConnected(true);
      setConnecting(false);
      setConnectionError(null);
    });
    
    s.on("connect_error", (error) => {
      console.error("[useSocket] Connection error:", error.message);
      setConnectionError(error.message || "Connection failed");
      setConnected(false);
      setConnecting(false);
    });
    
    s.on("disconnect", (reason) => {
      console.warn("[useSocket] Disconnected:", reason);
      setConnected(false);
      setConnecting(false);
      setPeerConnected(false);
      setEncrypted(false);
      setSharedKey(null);
      keySentRef.current = false;
      
      if (reason === "io server disconnect") {
        setConnectionError("Server disconnected");
      } else if (reason === "transport close" || reason === "transport error") {
        setConnectionError("Connection lost");
        setConnecting(true);
      }
    });
    
    s.on("reconnect", () => {
      console.log("[useSocket] ✅ Reconnected");
      setConnected(true);
      setConnecting(false);
      setConnectionError(null);
    });
    
    s.on("reconnect_failed", () => {
      console.error("[useSocket] ❌ Reconnection failed");
      setConnectionError("Failed to reconnect. Please refresh the page.");
      setConnecting(false);
    });

    // joined room — generate key pair; if a peer already exists, note them
    s.on("joined", async ({ token, peerName: existingPeer }: { token: string; peerName: string | null }) => {
      const keyPair = await generateKeyPair();
      keyPairRef.current = keyPair;

      if (existingPeer) {
        setPeerName(existingPeer);
        setPeerConnected(true);
      }
    });

    // peer joined — we're User 1, send our public key
    s.on("peer-joined", async ({ name }: { name: string }) => {
      setPeerName(name);
      setPeerConnected(true);
      setIsFirstUser(true);

      if (keyPairRef.current && roomIdRef.current) {
        const pubKey = await exportPublicKey(keyPairRef.current.publicKey);
        s.emit("key-exchange", {
          roomId: roomIdRef.current,
          publicKey: pubKey,
        });
        keySentRef.current = true;
      }
    });

    // receive peer's public key — derive shared secret
    s.on("key-exchange", async ({ publicKey }: { publicKey: string }) => {
      if (!keyPairRef.current) return;

      try {
        const peerPubKey = await importPublicKey(publicKey);
        const derived = await deriveSharedKey(
          keyPairRef.current.privateKey,
          peerPubKey
        );
        setSharedKey(derived);
        setEncrypted(true);
        setPeerConnected(true);

        // Only send our key back if we haven't already (we're User 2)
        if (!keySentRef.current && roomIdRef.current) {
          const ourPubKey = await exportPublicKey(keyPairRef.current.publicKey);
          socketRef.current?.emit("key-exchange", {
            roomId: roomIdRef.current,
            publicKey: ourPubKey,
          });
          keySentRef.current = true;
        }
      } catch {
        // key exchange failed
      }
    });

    s.on("peer-left", ({ name }: { name: string }) => {
      setPeerName(null);
      setPeerConnected(false);
      setEncrypted(false);
      setSharedKey(null);
      keySentRef.current = false;
    });

    s.on("room-full", () => setRoomFull(true));
    s.on("chat-ended", () => setChatEnded(true));

    s.on("typing", ({ name }: { name: string }) => {
      setTypingUser(name);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUser(null), 2000);
    });

    s.on("stop-typing", () => setTypingUser(null));

    s.on("error-msg", ({ message }: { message: string }) => {
      console.warn("[Whispr] Server:", message);
    });

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const joinRoom = useCallback(
    (roomId: string, name: string, rejoining?: boolean) => {
      roomIdRef.current = roomId;
      socketRef.current?.emit("join-room", { roomId, name, rejoining });
    },
    []
  );

  const endChat = useCallback((roomId: string) => {
    socketRef.current?.emit("end-chat", { roomId });
    setPeerConnected(false);
    setEncrypted(false);
    setSharedKey(null);
  }, []);

  const sendTyping = useCallback((roomId: string, name: string) => {
    socketRef.current?.emit("typing", { roomId, name });
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit("stop-typing", { roomId });
  }, []);

  return {
    connected,
    connecting,
    connectionError,
    peerName,
    peerConnected,
    roomFull,
    chatEnded,
    typingUser,
    encrypted,
    sharedKey,
    isFirstUser,
    joinRoom,
    endChat,
    sendTyping,
    stopTyping,
  };
}
