"use client";

// ============================================================
// Landing Page — Whispr home with Antigravity particle background
// ============================================================

import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { Lock, Mic } from "lucide-react";
import dynamic from "next/dynamic";

const Antigravity = dynamic(() => import("@/components/Antigravity"), {
  ssr: false,
});

export default function Home() {
  const router = useRouter();

  function startChat() {
    const roomId = nanoid(CONFIG.ROOM_ID_LENGTH);
    router.push(`/chat/${roomId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0">
        <Antigravity
          count={300}
          magnetRadius={6}
          ringRadius={7}
          waveSpeed={0.4}
          waveAmplitude={1}
          particleSize={1.5}
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

      <div className="pointer-events-none flex flex-col items-center gap-8 px-6 py-10 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 relative">
        <div className="flex flex-col items-center gap-3">
          <Logo size={48} />
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            whispr
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
            Ephemeral conversations. End-to-end encrypted. No trace.
          </p>
        </div>

        <Button onClick={startChat} size="lg" className="rounded-xl pointer-events-auto">
          Start new chat
        </Button>

        <div className="flex items-center gap-6 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <Lock className="size-2.5" />
            e2e encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-primary/50" />
            no storage
          </span>
          <span className="flex items-center gap-1.5">
            <Mic className="size-2.5" />
            voice &amp; images
          </span>
        </div>
      </div>
    </div>
  );
}
