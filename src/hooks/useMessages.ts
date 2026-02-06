"use client";

// ============================================================
// useMessages — message send/receive with E2EE
//
// - Outgoing messages encrypted with shared AES-256-GCM key
// - Incoming messages decrypted with the same key
// - Plaintext stored locally in IndexedDB
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { saveMessage, getMessages, clearRoom, cleanExpired } from "@/lib/db";
import { getSocket } from "@/lib/socket";
import { encrypt, decrypt } from "@/lib/crypto";
import { sanitizeText, sanitizeName } from "@/lib/utils";
import { playMessageSentSound, playMessageReceivedSound } from "@/lib/sounds";
import type { ChatMessage, MessageType } from "@/types";

export function useMessages(
  roomId: string,
  sharedKey: CryptoKey | null,
  isFirstUser: boolean
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const initialized = useRef(false);
  const sharedKeyRef = useRef<CryptoKey | null>(sharedKey);
  const syncHistorySent = useRef(false);
  const currentRoomId = useRef<string>("");

  // Keep ref in sync
  useEffect(() => {
    sharedKeyRef.current = sharedKey;
  }, [sharedKey]);

  // Reset flags and reload messages when room changes
  useEffect(() => {
    if (currentRoomId.current !== roomId) {
      currentRoomId.current = roomId;
      syncHistorySent.current = false;
      initialized.current = false;
    }
    
    // Load messages for current room
    if (!initialized.current) {
      initialized.current = true;
      cleanExpired();
      getMessages(roomId).then(setMessages);
    }
  }, [roomId]);

  // Listen for incoming messages
  useEffect(() => {
    const socket = getSocket();

    const handler = async (wire: {
      sender: string;
      type: MessageType;
      encrypted: string;
      iv: string;
      timestamp: number;
    }) => {
      const key = sharedKeyRef.current;
      if (!key) {
        console.warn("[useMessages] No shared key for decryption");
        return;
      }

      // Only process messages for current room
      if (currentRoomId.current !== roomId) {
        return;
      }

      try {
        const plaintext = await decrypt(key, wire.encrypted, wire.iv);
        const parsed = JSON.parse(plaintext) as { text?: string; data?: string };

        const saved = await saveMessage({
          roomId: currentRoomId.current,
          sender: sanitizeName(wire.sender),
          type: wire.type,
          text: parsed.text ? sanitizeText(parsed.text) : undefined,
          data: parsed.data,
          timestamp: wire.timestamp,
          isMine: false,
        });
        
        // Only update if still in same room
        if (currentRoomId.current === roomId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.timestamp === saved.timestamp && m.sender === saved.sender);
            return exists ? prev : [...prev, saved];
          });
          playMessageReceivedSound();
        }
      } catch (error) {
        console.warn("[useMessages] Decryption failed:", error);
      }
    };

    socket.on("receive-message", handler);
    return () => {
      socket.off("receive-message", handler);
    };
  }, [roomId]);

  // Sync history to new peer when they join
  useEffect(() => {
    if (!isFirstUser || !sharedKey || syncHistorySent.current) return;

    const socket = getSocket();
    const handler = async () => {
      const key = sharedKeyRef.current;
      if (!key || syncHistorySent.current) return;

      const localMessages = await getMessages(roomId);
      if (localMessages.length === 0) return;

      syncHistorySent.current = true;

      const encrypted = await Promise.all(
        localMessages.map(async (msg) => {
          const plaintext = JSON.stringify({ text: msg.text, data: msg.data });
          const enc = await encrypt(key, plaintext);
          return {
            sender: msg.sender,
            type: msg.type,
            encrypted: enc.encrypted,
            iv: enc.iv,
            timestamp: msg.timestamp,
          };
        })
      );

      socket.emit("sync-history", { roomId, messages: encrypted });
    };

    handler();
  }, [isFirstUser, sharedKey, roomId]);

  // Receive synced history
  useEffect(() => {
    const socket = getSocket();

    const handler = async ({ messages: encMsgs }: { messages: Array<{
      sender: string;
      type: MessageType;
      encrypted: string;
      iv: string;
      timestamp: number;
    }> }) => {
      const key = sharedKeyRef.current;
      if (!key || !Array.isArray(encMsgs)) return;

      for (const wire of encMsgs) {
        try {
          const plaintext = await decrypt(key, wire.encrypted, wire.iv);
          const parsed = JSON.parse(plaintext) as { text?: string; data?: string };

          await saveMessage({
            roomId,
            sender: sanitizeName(wire.sender),
            type: wire.type,
            text: parsed.text ? sanitizeText(parsed.text) : undefined,
            data: parsed.data,
            timestamp: wire.timestamp,
            isMine: false,
          });
        } catch {
          // skip corrupted messages
        }
      }

      // Reload from DB to get proper ordering
      const all = await getMessages(roomId);
      setMessages(all);
    };

    socket.on("sync-history", handler);
    return () => {
      socket.off("sync-history", handler);
    };
  }, [roomId]);

  /** Send a message — encrypts with shared key */
  const sendMessage = useCallback(
    async (sender: string, type: MessageType, text?: string, data?: string) => {
      const key = sharedKeyRef.current;
      if (!key) {
        console.warn("[useMessages] Cannot send message: no shared key");
        return;
      }

      if (currentRoomId.current !== roomId) {
        console.warn("[useMessages] Cannot send message: room mismatch");
        return;
      }

      try {
        const cleanText = text ? sanitizeText(text) : undefined;
        const timestamp = Date.now();
        const plaintext = JSON.stringify({ text: cleanText, data });
        const enc = await encrypt(key, plaintext);

        const socket = getSocket();
        socket.emit("send-message", {
          roomId: currentRoomId.current,
          sender: sanitizeName(sender),
          type,
          encrypted: enc.encrypted,
          iv: enc.iv,
          timestamp,
        });

        const saved = await saveMessage({
          roomId: currentRoomId.current,
          sender: sanitizeName(sender),
          type,
          text: cleanText,
          data,
          timestamp,
          isMine: true,
        });
        
        // Only update if still in same room
        if (currentRoomId.current === roomId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.timestamp === saved.timestamp && m.sender === saved.sender);
            return exists ? prev : [...prev, saved];
          });
          playMessageSentSound();
        }
      } catch (error) {
        console.error("[useMessages] Failed to send message:", error);
      }
    },
    [roomId]
  );

  /** Clear all messages for this room */
  const clear = useCallback(async () => {
    await clearRoom(roomId);
    setMessages([]);
  }, [roomId]);

  return { messages, sendMessage, clear };
}
