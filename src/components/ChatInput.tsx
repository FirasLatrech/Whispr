"use client";

// ============================================================
// ChatInput — message input with emoji, GIF, image & voice
// ============================================================

import { useState, useRef, useCallback } from "react";
import { compressImage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Mic, Send, X } from "lucide-react";
import EmojiPicker from "@/components/EmojiPicker";
import GifPicker from "@/components/GifPicker";

interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendImage: (data: string) => void;
  onSendVoice: (data: string) => void;
  onSendGif: (url: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  onSendText,
  onSendImage,
  onSendVoice,
  onSendGif,
  onTyping,
  onStopTyping,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
    onStopTyping();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(onStopTyping, 1500);
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    onSendImage(compressed);
    if (fileInput.current) fileInput.current.value = "";
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          onSendVoice(reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000
      );
    } catch {
      // microphone denied
    }
  }, [onSendVoice]);

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.ondataavailable = null;
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
    }
    setRecording(false);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    chunks.current = [];
  }

  function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function handleEmojiSelect(emoji: string) {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  }

  function handleGifSelect(url: string) {
    onSendGif(url);
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
        <span className="size-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-xs text-destructive font-mono flex-1">
          {fmtTime(recordingTime)}
        </span>
        <Button variant="ghost" size="sm" onClick={cancelRecording}>
          <X className="size-3.5" />
          <span className="text-xs">cancel</span>
        </Button>
        <Button size="sm" onClick={stopRecording}>
          <Send className="size-3.5" />
          <span className="text-xs">send</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImage}
        />

        <EmojiPicker onSelect={handleEmojiSelect} disabled={disabled} />

        <GifPicker onSelect={handleGifSelect} disabled={disabled} />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
          title="Send image"
        >
          <ImageIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={startRecording}
          disabled={disabled}
          title="Record voice"
        >
          <Mic className="size-4" />
        </Button>

        <Input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          className="flex-1"
        />

        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
