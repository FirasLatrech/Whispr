// ============================================================
// Shared type definitions for Whispr
// Used by both server and client
// ============================================================

/** Message content types supported by the chat */
export type MessageType = "text" | "image" | "voice" | "gif";

/** A message as transmitted over the wire (encrypted payload) */
export interface WireMessage {
  roomId: string;
  sender: string;
  type: MessageType;
  encrypted: string;   // base64 AES-256-GCM ciphertext
  iv: string;          // base64 initialization vector
  timestamp: number;
}

/** A message stored locally in IndexedDB (decrypted) */
export interface ChatMessage {
  id?: number;
  roomId: string;
  sender: string;
  type: MessageType;
  text?: string;
  data?: string;       // base64 for image/voice
  timestamp: number;
  isMine: boolean;
}

/** Public key exchange payload for E2EE handshake */
export interface KeyExchangePayload {
  roomId: string;
  publicKey: string;   // JWK-serialized ECDH public key
}

// ============================================================
// Socket event payloads
// ============================================================

export interface JoinRoomPayload {
  roomId: string;
  name: string;
  rejoining?: boolean;
}

export interface TypingPayload {
  roomId: string;
  name: string;
}

export interface EndChatPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  sender: string;
  type: MessageType;
  encrypted: string;
  iv: string;
  timestamp: number;
}
