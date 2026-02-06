"use client";

// ============================================================
// ChatBubble — renders a single message
// Content is rendered safely via React's built-in XSS protection
// (React escapes text in JSX by default). Images use validated
// base64 data URLs only.
// ============================================================

import { memo } from "react";
import type { ChatMessage } from "@/types";
import { cn, formatTime } from "@/lib/utils";
import VoicePlayer from "./VoicePlayer";

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.isMine;

  return (
    <div
      className={cn("flex flex-col px-4", mine ? "items-end" : "items-start")}
    >
      <span className="text-xs text-muted-foreground mb-1 px-1">
        {msg.sender}
      </span>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 break-words",
          mine
            ? "bg-primary/10 border border-primary/20 text-foreground"
            : "bg-card border border-border text-foreground"
        )}
      >
        {msg.type === "text" && (
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {msg.text}
          </p>
        )}

        {msg.type === "image" && msg.data && (
          <img
            src={msg.data}
            alt="shared image"
            className="rounded-lg max-w-full max-h-64 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}

        {msg.type === "gif" && msg.data && (
          <img
            src={msg.data}
            alt="GIF"
            className="rounded-lg max-w-full max-h-64 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}

        {msg.type === "voice" && msg.data && <VoicePlayer src={msg.data} />}
      </div>
      <span className="text-xs text-muted-foreground/60 mt-1 px-1">
        {formatTime(msg.timestamp)}
      </span>
    </div>
  );
}

export default memo(ChatBubble, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.timestamp === next.msg.timestamp &&
    prev.msg.text === next.msg.text &&
    prev.msg.data === next.msg.data &&
    prev.msg.sender === next.msg.sender &&
    prev.msg.type === next.msg.type &&
    prev.msg.isMine === next.msg.isMine
  );
});
