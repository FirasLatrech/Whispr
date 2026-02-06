// ============================================================
// IndexedDB Storage — browser-only message persistence
//
// Messages are stored DECRYPTED locally (they were encrypted
// on the wire, decrypted on receipt). IndexedDB is sandboxed
// to the origin and not accessible by other sites.
//
// All messages are wiped on "end chat" and auto-expire at 24h.
// ============================================================

import { openDB, type DBSchema } from "idb";
import { CONFIG } from "./constants";
import type { ChatMessage } from "@/types";

interface InstantChatDB extends DBSchema {
  messages: {
    key: number;
    value: ChatMessage;
    indexes: { "by-room": string };
  };
}

function getDB() {
  return openDB<InstantChatDB>(CONFIG.DB_NAME, CONFIG.DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("messages", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("by-room", "roomId");
    },
  });
}

export async function saveMessage(msg: ChatMessage): Promise<ChatMessage> {
  const db = await getDB();
  const id = await db.add("messages", msg);
  return { ...msg, id: id as number };
}

export async function getMessages(roomId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  return db.getAllFromIndex("messages", "by-room", roomId);
}

export async function clearRoom(roomId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  const index = tx.store.index("by-room");
  let cursor = await index.openCursor(roomId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Safety net: purge messages older than 24 hours */
export async function cleanExpired(): Promise<void> {
  const db = await getDB();
  const cutoff = Date.now() - CONFIG.MESSAGE_TTL_MS;
  const tx = db.transaction("messages", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.timestamp < cutoff) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
