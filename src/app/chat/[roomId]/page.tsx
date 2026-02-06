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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatHeader from "@/components/ChatHeader";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import StatusBanner from "@/components/StatusBanner";
import TypingIndicator from "@/components/TypingIndicator";
import CaptchaChallenge from "@/components/CaptchaChallenge";
import dynamic from "next/dynamic";

const Antigravity = dynamic(() => import("@/components/Antigravity"), {
  ssr: false,
});

const SESSION_KEY_PREFIX = "whispr:name:";

function getStoredName(roomId: string): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${roomId}`) || "";
}

function storeName(roomId: string, name: string): void {
  sessionStorage.setItem(`${SESSION_KEY_PREFIX}${roomId}`, name);
}

function clearStoredName(roomId: string): void {
  sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${roomId}`);
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [captchaId, setCaptchaId] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    connected,
    peerName,
    peerConnected,
    roomFull,
    chatEnded,
    captchaFailed,
    typingUser,
    encrypted,
    sharedKey,
    isFirstUser,
    joinRoom,
    endChat,
    sendTyping,
    stopTyping,
    resetCaptchaFailed,
  } = useSocket();

  const { messages, sendMessage, clear } = useMessages(roomId, sharedKey, isFirstUser);

  // --------------------------------------------------------
  // Restore name from sessionStorage on mount (survive reload)
  // --------------------------------------------------------
  useEffect(() => {
    const saved = getStoredName(roomId);
    if (saved) {
      setName(saved);
      joinRoom(roomId, saved, undefined, undefined, true);
      setJoined(true);
    }
  }, [roomId, joinRoom]);

  // auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typingUser]);

  // handle chat ended
  useEffect(() => {
    if (chatEnded) {
      clearStoredName(roomId);
      clear();
      setTimeout(() => router.push("/"), 1500);
    }
  }, [chatEnded, clear, router, roomId]);

  const handleJoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = sanitizeName(name);
      if (!cleaned || !captchaAnswer.trim()) return;
      setName(cleaned);
      storeName(roomId, cleaned);
      resetCaptchaFailed();
      joinRoom(roomId, cleaned, captchaId, captchaAnswer);
      setJoined(true);
    },
    [name, roomId, captchaId, captchaAnswer, joinRoom, resetCaptchaFailed]
  );

  function handleEndChat() {
    clearStoredName(roomId);
    endChat(roomId);
    clear();
    router.push("/");
  }

  // if CAPTCHA failed, boot back to join screen
  useEffect(() => {
    if (captchaFailed) {
      setJoined(false);
      clearStoredName(roomId);
    }
  }, [captchaFailed, roomId]);

  const handleCaptchaChange = useCallback((id: string, answer: string) => {
    setCaptchaId(id);
    setCaptchaAnswer(answer);
  }, []);

  async function handleSendText(text: string) {
    await sendMessage(name, "text", text);
  }

  async function handleSendImage(data: string) {
    await sendMessage(name, "image", undefined, data);
  }

  async function handleSendVoice(data: string) {
    await sendMessage(name, "voice", undefined, data);
  }

  async function handleSendGif(url: string) {
    await sendMessage(name, "gif", undefined, url);
  }

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
          className="pointer-events-none flex flex-col items-center gap-4 px-6 py-8 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 relative"
        >
          <h2 className="text-lg font-medium text-foreground tracking-tight">
            Join chat
          </h2>
          <p className="text-xs text-muted-foreground">Room #{roomId}</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            maxLength={24}
            className="w-56 text-center pointer-events-auto"
          />
          <div className="pointer-events-auto">
            <CaptchaChallenge
              onChange={handleCaptchaChange}
              failed={captchaFailed}
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim() || !captchaAnswer.trim()}
            className="rounded-xl pointer-events-auto"
          >
            Join
          </Button>
          <p className="text-[10px] text-muted-foreground/60 text-center max-w-[200px]">
            Messages are end-to-end encrypted and never stored on our servers
          </p>
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
    <div className="min-h-screen flex flex-col">
      <div className="max-w-[600px] w-full mx-auto flex flex-col h-screen">
        <ChatHeader
          roomId={roomId}
          encrypted={encrypted}
          onEndChat={handleEndChat}
        />

        <div className="px-4 py-2">
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
          className="flex-1 overflow-y-auto py-4 space-y-3 scrollbar-hide"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground/40">
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
          onTyping={() => sendTyping(roomId, name)}
          onStopTyping={() => stopTyping(roomId)}
          disabled={!canSend}
        />
      </div>
    </div>
  );
}
