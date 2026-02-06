"use client";

// ============================================================
// GitHubStars — simple star CTA button
// ============================================================

import { useState, useCallback } from "react";
import { Star, Github } from "lucide-react";

const REPO_URL = "https://github.com/FirasLatrech/Whispr";

export default function GitHubStars() {
  const [hovered, setHovered] = useState(false);
  const [sparkle, setSparkle] = useState(false);

  const handleClick = useCallback(() => {
    setSparkle(true);
    setTimeout(() => setSparkle(false), 600);
  }, []);

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto group relative inline-flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm text-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_0_20px_-4px] hover:shadow-primary/20"
    >
      {/* GitHub icon */}
      <Github className="size-4 text-muted-foreground group-hover:text-foreground transition-colors duration-300" />

      {/* Divider */}
      <span className="w-px h-4 bg-border/60" />

      {/* Star section */}
      <span className="inline-flex items-center gap-1.5">
        <span className="relative">
          <Star
            className={`size-4 transition-all duration-300 ${
              hovered
                ? "text-yellow-400 fill-yellow-400 scale-110"
                : "text-yellow-400/60 animate-star-pulse"
            } ${sparkle ? "animate-star-pop" : ""}`}
          />
          {/* Sparkle particles */}
          {sparkle && (
            <>
              <span className="absolute -top-1 -right-1 size-1 rounded-full bg-yellow-400 animate-sparkle-1" />
              <span className="absolute -top-0.5 -left-1.5 size-0.5 rounded-full bg-yellow-300 animate-sparkle-2" />
              <span className="absolute -bottom-1 right-0 size-0.5 rounded-full bg-yellow-400 animate-sparkle-3" />
            </>
          )}
        </span>
        <span className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
          {hovered ? "Star us" : "Star"}
        </span>
      </span>
    </a>
  );
}
