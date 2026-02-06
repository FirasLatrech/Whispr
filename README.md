# Whispr

[![GitHub stars](https://img.shields.io/github/stars/FirasLatrech/Whispr?style=social)](https://github.com/FirasLatrech/Whispr)

Ephemeral 1-on-1 encrypted chat. No accounts. No history. No trace.

---

## What it does

Two people open a link, enter a name, and start talking. Every message is end-to-end encrypted in the browser before it ever touches the server. When the chat ends, everything is wiped — the server never stored anything in the first place.

## How it works

```
User A                     Server                     User B
  |                          |                          |
  |-------- join-room ------>|                          |
  |<------- joined ----------|                          |
  |   (generate ECDH keys)   |                          |
  |                          |<------- join-room -------|
  |                          |-------- joined --------->|
  |                          |   (generate ECDH keys)   |
  |<------ peer-joined ------|                          |
  |------- key-exchange ---->|-------- key-exchange --->|
  |                          |<------- key-exchange ----|
  |<------ key-exchange -----|                          |
  |                          |                          |
  |   [shared AES-256-GCM key derived on both sides]    |
  |                          |                          |
  |-- send-message (cipher)->|-- receive-message ------>|
  |<- receive-message -------|<- send-message (cipher)--|
```

The server is a dumb relay. It forwards opaque ciphertext between two authenticated peers and nothing more.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Realtime | Socket.IO (WebSocket + polling fallback) |
| Encryption | Web Crypto API — ECDH P-256 + AES-256-GCM |
| Local storage | IndexedDB via `idb` (24h auto-expiry) |
| UI | Tailwind CSS v4 + shadcn/ui (new-york) + Lucide icons |
| Visuals | Three.js particle background (`@react-three/fiber`) |
| Rich media | emoji-mart, Giphy SDK, voice recording, image compression |
| Server runtime | `tsx` (TypeScript execution without build step) |

## Security

1. **End-to-end encryption** — ECDH key exchange + AES-256-GCM. The server never sees plaintext.
2. **Zero server storage** — Messages exist only in each user's browser (IndexedDB). The server holds nothing.
3. **Rate limiting** — 30 messages per 10-second window per socket.
4. **IP connection limits** — Max 5 concurrent connections per IP.
5. **HMAC room tokens** — Rooms are signed with a boot-time secret (constant-time verification).
6. **Input validation** — Every socket event payload is validated server-side.
7. **Security headers** — Applied to all HTTP responses.
8. **Room caps** — Max 2 users per room. Rooms auto-expire after 1 hour of inactivity.
9. **Image compression** — Client-side, capped at 800px width / 70% quality before encryption.

## Project structure

```
server/
  index.ts              Custom HTTP + Socket.IO server (9 security layers)
  roomManager.ts        In-memory room state (max 2 users, HMAC tokens, auto-expiry)
  lib/
    rateLimiter.ts      Per-socket message rate limiting
    securityHeaders.ts  HTTP security headers
    validate.ts         Input validation helpers

src/
  app/
    layout.tsx          Root layout (Inter font, dark mode, TooltipProvider)
    page.tsx            Landing page (Antigravity background + "Start new chat")
    globals.css         Tailwind v4 theme (green oklch palette)
    chat/[roomId]/
      page.tsx          Chat room (join form, message list, input bar)

  components/
    Antigravity.tsx     Three.js particle background
    ChatBubble.tsx      Single message render (text/image/gif/voice)
    ChatHeader.tsx      Room info, E2EE badge, copy link, end chat
    ChatInput.tsx       Text input + emoji + GIF + image + voice recording
    EmojiPicker.tsx     emoji-mart picker
    GifPicker.tsx       Giphy search + trending
    Logo.tsx            Inline SVG logo
    StatusBanner.tsx    Connection + peer + encryption status
    TypingIndicator.tsx Animated typing dots
    VoicePlayer.tsx     Audio playback
    ui/                 shadcn/ui primitives (button, input, badge, etc.)

  hooks/
    useSocket.ts        Socket.IO connection + ECDH key exchange + peer state
    useMessages.ts      Encrypt/decrypt + IndexedDB persistence + history sync

  lib/
    constants.ts        App-wide configuration
    crypto.ts           ECDH P-256 + AES-256-GCM (Web Crypto API)
    db.ts               IndexedDB wrapper (save, load, clear, expire)
    socket.ts           Socket.IO client singleton
    utils.ts            cn(), formatTime(), sanitize, compressImage

  types/
    index.ts            Shared type definitions
```

## Getting started

```bash
# install dependencies
npm install

# run dev server (Next.js + Socket.IO on port 3000)
npm run dev

# production build
npm run build
NODE_ENV=production npm start
```

Open [http://localhost:3000](http://localhost:3000), click **Start new chat**, share the link with someone, and talk.

## Room rules

- Max **2 users** per room
- Rooms expire after **1 hour** of inactivity
- Messages expire from IndexedDB after **24 hours**
- "End chat" wipes all local data immediately
- Refreshing the page reconnects to the same room (name persisted in sessionStorage)

## License

MIT
