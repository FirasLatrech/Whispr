"use client";

// ============================================================
// Chat Page — 1-on-1 ephemeral encrypted chat
//
// Flow:
//   1. User enters name (persisted in sessionStorage per room)
//   2. Socket connects + joins room
//   3. ECDH key exchange with single peer
//   4. Messages encrypted with shared AES-256-GCM key
//   5. "End chat" wipes IndexedDB + sessionStorage
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useMessages } from "@/hooks/useMessages";
import { sanitizeName } from "@/lib/utils";
import { playTypingSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatHeader from "@/components/ChatHeader";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import StatusBanner from "@/components/StatusBanner";
import TypingIndicator from "@/components/TypingIndicator";
import GitHubStars from "@/components/GitHubStars";
import dynamic from "next/dynamic";

const Antigravity = dynamic(() => import("@/components/Antigravity"), {
  ssr: false,
});

const SESSION_KEY_PREFIX = "whispr:name:";
const CHAT_ACTIVE_KEY_PREFIX = "whispr:active:";

const storageCache = new Map<string, { name: string; active: boolean }>();

function getStoredName(roomId: string): string {
  if (typeof window === "undefined") return "";
  const cached = storageCache.get(roomId);
  if (cached) return cached.name;
  const name = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${roomId}`) || "";
  const active = sessionStorage.getItem(`${CHAT_ACTIVE_KEY_PREFIX}${roomId}`) === "true";
  storageCache.set(roomId, { name, active });
  return name;
}

function storeName(roomId: string, name: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${SESSION_KEY_PREFIX}${roomId}`, name);
  sessionStorage.setItem(`${CHAT_ACTIVE_KEY_PREFIX}${roomId}`, "true");
  storageCache.set(roomId, { name, active: true });
}

function clearStoredName(roomId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${roomId}`);
  sessionStorage.removeItem(`${CHAT_ACTIVE_KEY_PREFIX}${roomId}`);
  storageCache.delete(roomId);
}

function isChatActive(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  const cached = storageCache.get(roomId);
  if (cached) return cached.active;
  const active = sessionStorage.getItem(`${CHAT_ACTIVE_KEY_PREFIX}${roomId}`) === "true";
  const name = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${roomId}`) || "";
  storageCache.set(roomId, { name, active });
  return active;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const hasAttemptedRejoin = useRef(false);
  const initialized = useRef(false);

  // Initialize from sessionStorage on mount (client-side only)
  useEffect(() => {
    if (initialized.current || typeof window === "undefined") return;
    initialized.current = true;

    const savedName = getStoredName(roomId);
    const chatActive = isChatActive(roomId);

    if (savedName) {
      setName(savedName);
      setJoined(true);
      
      // Set active flag if missing (backward compatibility)
      if (!chatActive) {
        sessionStorage.setItem(`${CHAT_ACTIVE_KEY_PREFIX}${roomId}`, "true");
        storageCache.set(roomId, { name: savedName, active: true });
      }
    }
  }, [roomId]);

  const {
    connected,
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
  } = useSocket();

  const { messages, sendMessage, clear } = useMessages(roomId, sharedKey, isFirstUser);
  const prevTypingUser = useRef<string | null>(null);

  // Play typing sound when peer starts typing
  useEffect(() => {
    if (typingUser && typingUser !== prevTypingUser.current) {
      playTypingSound();
      prevTypingUser.current = typingUser;
    } else if (!typingUser) {
      prevTypingUser.current = null;
    }
  }, [typingUser]);

  // Rejoin room when socket connects (for reload scenario)
  useEffect(() => {
    if (hasAttemptedRejoin.current) return;
    
    const saved = getStoredName(roomId);
    if (saved && connected && joined) {
      hasAttemptedRejoin.current = true;
      joinRoom(roomId, saved, true);
    }
  }, [roomId, joinRoom, connected, joined]);

  // auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, typingUser]);

  // scroll progress indicator
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateScrollProgress() {
      if (!el) return;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      const totalScroll = scrollHeight - clientHeight;
      const progress = totalScroll > 0 ? (scrollTop / totalScroll) * 100 : 0;
      setScrollProgress((prev) => (prev !== progress ? progress : prev));
    }

    el.addEventListener("scroll", updateScrollProgress, { passive: true });
    updateScrollProgress();

    return () => {
      if (el) {
        el.removeEventListener("scroll", updateScrollProgress);
      }
    };
  }, []);

  // handle chat ended
  useEffect(() => {
    if (chatEnded) {
      clearStoredName(roomId);
      setJoined(false);
      clear();
      setTimeout(() => router.push("/"), 1500);
    }
  }, [chatEnded, clear, router, roomId]);

  const handleJoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = sanitizeName(name);
      if (!cleaned) return;
      setName(cleaned);
      storeName(roomId, cleaned);
      joinRoom(roomId, cleaned);
      setJoined(true);
    },
    [name, roomId, joinRoom]
  );

  function handleEndChat() {
    clearStoredName(roomId);
    setJoined(false);
    endChat(roomId);
    clear();
    router.push("/");
  }


  const handleSendText = useCallback(
    (text: string) => {
      sendMessage(name, "text", text);
    },
    [name, sendMessage]
  );

  const handleSendImage = useCallback(
    (data: string) => {
      sendMessage(name, "image", undefined, data);
    },
    [name, sendMessage]
  );

  const handleSendVoice = useCallback(
    (data: string) => {
      sendMessage(name, "voice", undefined, data);
    },
    [name, sendMessage]
  );

  const handleSendGif = useCallback(
    (url: string) => {
      sendMessage(name, "gif", undefined, url);
    },
    [name, sendMessage]
  );

  // --------------------------------------------------------
  // Chat ended screen
  // --------------------------------------------------------

  if (chatEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Chat ended</p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            All messages have been deleted
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Name entry screen
  // --------------------------------------------------------

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="absolute inset-0">
          <Antigravity
            count={200}
            magnetRadius={6}
            ringRadius={7}
            waveSpeed={0.4}
            waveAmplitude={1}
            particleSize={1.2}
            lerpSpeed={0.05}
            color="#22c55e"
            autoAnimate
            particleVariance={1}
            rotationSpeed={0}
            depthFactor={1}
            pulseSpeed={3}
            particleShape="capsule"
            fieldStrength={10}
          />
        </div>
        <form
          onSubmit={handleJoin}
          className="pointer-events-none flex flex-col items-center gap-4 px-6 py-8 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 relative w-full max-w-md"
        >
          <h2 className="text-xl font-medium text-foreground tracking-tight">
            Join chat
          </h2>
          <p className="text-sm text-muted-foreground">Room #{roomId}</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            maxLength={24}
            className="w-full text-center pointer-events-auto"
          />
          <Button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-xl pointer-events-auto"
          >
            Join
          </Button>
          <p className="text-xs text-muted-foreground/60 text-center max-w-[200px]">
            Messages are end-to-end encrypted and never stored on our servers
          </p>
          <GitHubStars />
        </form>
      </div>
    );
  }

  // --------------------------------------------------------
  // Room full screen
  // --------------------------------------------------------

  if (roomFull) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Room is full</p>
          <p className="text-xs text-muted-foreground/60">
            This room already has 2 participants
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Main chat UI
  // --------------------------------------------------------

  const canSend = encrypted && peerConnected;

  return (
    <div className="min-h-screen flex flex-col w-full">
      <div className="w-full flex flex-col h-screen">
        <ChatHeader
          roomId={roomId}
          encrypted={encrypted}
          onEndChat={handleEndChat}
        />

        <div className="px-4 py-2 relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/30">
            <div
              className="h-full bg-primary transition-all duration-150 ease-out"
              style={{ width: `${scrollProgress}%` }}
            />
          </div>
          <StatusBanner
            connected={connected}
            peerConnected={peerConnected}
            peerName={peerName}
            roomFull={roomFull}
            encrypted={encrypted}
          />
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto py-4 px-4 space-y-3 scrollbar-hide"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground/40">
                {peerConnected
                  ? encrypted
                    ? "Send a message to start the conversation"
                    : "Establishing encryption..."
                  : "Share the link to invite someone"}
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id ?? msg.timestamp} msg={msg} />
          ))}
          {typingUser && <TypingIndicator name={typingUser} />}
        </div>

        <ChatInput
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendVoice={handleSendVoice}
          onSendGif={handleSendGif}
          onTyping={useCallback(() => {
            sendTyping(roomId, name);
          }, [roomId, name, sendTyping])}
          onStopTyping={useCallback(() => {
            stopTyping(roomId);
          }, [roomId, stopTyping])}
          disabled={!canSend}
        />
      </div>
    </div>
  );
}
