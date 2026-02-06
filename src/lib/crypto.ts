// ============================================================
// End-to-End Encryption Module
//
// Protocol:
//   1. Each user generates an ECDH P-256 key pair on room join
//   2. Public keys are exchanged via the server (server never
//      sees private keys)
//   3. Both users derive the same shared secret via ECDH
//   4. The shared secret is used as an AES-256-GCM key
//   5. Every message is encrypted client-side before sending
//   6. The server only relays opaque ciphertext
//
// The server CANNOT read any messages.
// ============================================================

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const AES_ALGO = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/** Generate a new ECDH key pair for key exchange */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"]);
}

/** Export a public key to JWK string for transmission */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

/** Import a peer's public key from JWK string */
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, true, []);
}

/** Derive a shared AES-256-GCM key from own private key + peer public key */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false, // not extractable — key stays in memory only
    ["encrypt", "decrypt"]
  );
}

/** Encrypt plaintext with AES-256-GCM. Returns { ciphertext, iv } as base64 */
export async function encrypt(
  sharedKey: CryptoKey,
  plaintext: string
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    sharedKey,
    encoded
  );

  return {
    encrypted: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

/** Decrypt AES-256-GCM ciphertext. Returns plaintext string */
export async function decrypt(
  sharedKey: CryptoKey,
  encrypted: string,
  iv: string
): Promise<string> {
  const cipherBuffer = base64ToBuffer(encrypted);
  const ivBuffer = base64ToBuffer(iv);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv: ivBuffer },
    sharedKey,
    cipherBuffer
  );

  return new TextDecoder().decode(plainBuffer);
}

// ============================================================
// Helpers
// ============================================================

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
