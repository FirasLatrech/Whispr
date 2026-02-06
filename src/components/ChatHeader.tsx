"use client";

// ============================================================
// ChatHeader — room info, E2EE badge, copy link, end chat
// ============================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Lock, Copy, Check, LogOut } from "lucide-react";
import Logo from "@/components/Logo";

interface ChatHeaderProps {
  roomId: string;
  encrypted: boolean;
  onEndChat: () => void;
}

export default function ChatHeader({
  roomId,
  encrypted,
  onEndChat,
}: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/chat/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <Logo size={22} />
        <h1 className="text-sm font-medium text-foreground tracking-tight">
          whispr
        </h1>
        <span className="text-[10px] text-muted-foreground font-mono">
          #{roomId.slice(0, 8)}
        </span>
        {encrypted && (
          <Badge variant="outline" className="gap-1 text-primary border-primary/20 bg-primary/10 text-[10px] py-0">
            <Lock className="size-2.5" />
            e2ee
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={copyLink}>
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span className="text-xs">{copied ? "copied" : "copy link"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy room link to clipboard</TooltipContent>
        </Tooltip>
        <Button variant="destructive" size="sm" onClick={onEndChat}>
          <LogOut className="size-3.5" />
          <span className="text-xs">end chat</span>
        </Button>
      </div>
    </header>
  );
}
