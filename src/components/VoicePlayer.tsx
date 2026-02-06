"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface VoicePlayerProps {
  src: string;
}

export default function VoicePlayer({ src }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      tick();
    }
  }

  function tick() {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime / (audio.duration || 1));
    animRef.current = requestAnimationFrame(tick);
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
    cancelAnimationFrame(animRef.current);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onEnded={handleEnded}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        preload="metadata"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        className="shrink-0 rounded-full bg-primary/20 text-primary hover:bg-primary/30"
      >
        {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">
          {duration > 0 ? fmt(duration) : "0:00"}
        </span>
      </div>
    </div>
  );
}
