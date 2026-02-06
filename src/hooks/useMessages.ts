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
import type { ChatMessage, MessageType } from "@/types";

export function useMessages(
  roomId: string,
  sharedKey: CryptoKey | null,
  isFirstUser: boolean
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const initialized = useRef(false);
  const sharedKeyRef = useRef<CryptoKey | null>(sharedKey);

  // Keep ref in sync
  useEffect(() => {
    sharedKeyRef.current = sharedKey;
  }, [sharedKey]);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    cleanExpired();
    getMessages(roomId).then(setMessages);
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
      if (!key) return;

      try {
        const plaintext = await decrypt(key, wire.encrypted, wire.iv);
        const parsed = JSON.parse(plaintext) as { text?: string; data?: string };

        const saved = await saveMessage({
          roomId,
          sender: sanitizeName(wire.sender),
          type: wire.type,
          text: parsed.text ? sanitizeText(parsed.text) : undefined,
          data: parsed.data,
          timestamp: wire.timestamp,
          isMine: false,
        });
        setMessages((prev) => [...prev, saved]);
      } catch {
        // decryption failed
      }
    };

    socket.on("receive-message", handler);
    return () => {
      socket.off("receive-message", handler);
    };
  }, [roomId]);

  // Sync history to new peer when they join
  useEffect(() => {
    if (!isFirstUser || !sharedKey) return;

    const socket = getSocket();
    const handler = async () => {
      const key = sharedKeyRef.current;
      if (!key) return;

      const localMessages = await getMessages(roomId);
      if (localMessages.length === 0) return;

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

    // Send history once encryption is established
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
      if (!key) return;

      const cleanText = text ? sanitizeText(text) : undefined;
      const timestamp = Date.now();
      const plaintext = JSON.stringify({ text: cleanText, data });
      const enc = await encrypt(key, plaintext);

      const socket = getSocket();
      socket.emit("send-message", {
        roomId,
        sender: sanitizeName(sender),
        type,
        encrypted: enc.encrypted,
        iv: enc.iv,
        timestamp,
      });

      const saved = await saveMessage({
        roomId,
        sender: sanitizeName(sender),
        type,
        text: cleanText,
        data,
        timestamp,
        isMine: true,
      });
      setMessages((prev) => [...prev, saved]);
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
