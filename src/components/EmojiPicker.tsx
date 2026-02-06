"use client";

// ============================================================
// EmojiPicker — emoji-mart picker in a popover
//
// Inserts selected emoji at cursor position in the text input.
// Uses emoji-mart with dark theme to match the app.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

interface EmojiData {
  native: string;
}

export default function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Emoji"
      >
        <Smile className="size-4" />
      </Button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50">
          <Picker
            data={data}
            onEmojiSelect={(emoji: EmojiData) => {
              onSelect(emoji.native);
              setOpen(false);
            }}
            theme="dark"
            set="native"
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={1}
            perLine={8}
          />
        </div>
      )}
    </div>
  );
}
