"use client";

// ============================================================
// CaptchaChallenge — SVG CAPTCHA verification component
//
// Fetches a server-generated SVG CAPTCHA, displays it, and
// exposes the captchaId + user answer via onChange callback.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

interface CaptchaData {
  id: string;
  svg: string;
}

interface CaptchaChallengeProps {
  onChange: (captchaId: string, captchaAnswer: string) => void;
  failed?: boolean;
}

export default function CaptchaChallenge({ onChange, failed }: CaptchaChallengeProps) {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/captcha");
      const data: CaptchaData = await res.json();
      setCaptcha(data);
      onChange(data.id, "");
    } catch {
      // retry silently
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  // auto-refresh on failed verification
  useEffect(() => {
    if (failed) {
      fetchCaptcha();
    }
  }, [failed, fetchCaptcha]);

  function handleAnswerChange(value: string) {
    setAnswer(value);
    if (captcha) {
      onChange(captcha.id, value);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative flex items-center justify-center w-[200px] h-[60px] rounded-lg border border-border bg-background/50 overflow-hidden">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : captcha ? (
          <div
            dangerouslySetInnerHTML={{ __html: captcha.svg }}
            className="flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2 w-56">
        <Input
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Enter code"
          maxLength={10}
          className="text-center flex-1"
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={fetchCaptcha}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {failed && (
        <p className="text-xs text-destructive">
          Incorrect code. Try again.
        </p>
      )}
    </div>
  );
}
