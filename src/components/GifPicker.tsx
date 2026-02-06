"use client";

// ============================================================
// GifPicker — search and select GIFs via Giphy API
//
// Lightweight custom implementation using @giphy/js-fetch-api.
// Shows trending on open, search results on query.
// Returns the selected GIF URL to the parent.
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clapperboard, Search, Loader2, X } from "lucide-react";
import { GiphyFetch } from "@giphy/js-fetch-api";

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "";
const gf = new GiphyFetch(GIPHY_API_KEY);

interface GifItem {
  id: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
  title: string;
}

interface GifPickerProps {
  onSelect: (url: string) => void;
  disabled?: boolean;
}

export default function GifPicker({ onSelect, disabled }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchGifs = useCallback(async (searchTerm: string) => {
    if (!GIPHY_API_KEY) return;
    setLoading(true);
    try {
      const result = searchTerm.trim()
        ? await gf.search(searchTerm.trim(), { limit: 20, rating: "pg-13" })
        : await gf.trending({ limit: 20, rating: "pg-13" });

      const items: GifItem[] = result.data.map((g) => ({
        id: String(g.id),
        previewUrl:
          g.images.fixed_width_small?.url ||
          g.images.fixed_width?.url ||
          g.images.original?.url ||
          "",
        url: g.images.fixed_width?.url || g.images.original?.url || "",
        width: g.images.fixed_width?.width || g.images.original?.width || 200,
        height:
          g.images.fixed_width?.height || g.images.original?.height || 200,
        title: g.title || "",
      }));
      setGifs(items);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // fetch trending when opened
  useEffect(() => {
    if (open && gifs.length === 0) {
      fetchGifs("");
    }
  }, [open, gifs.length, fetchGifs]);

  // debounced search
  function handleSearchChange(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchGifs(value), 400);
  }

  function handleSelect(gif: GifItem) {
    onSelect(gif.url);
    setOpen(false);
    setQuery("");
    setGifs([]);
  }

  if (!GIPHY_API_KEY) return null;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Send GIF"
      >
        <Clapperboard className="size-4" />
      </Button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-[320px] max-h-[400px] bg-popover border border-border rounded-xl shadow-lg flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 p-2 border-b border-border">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search GIFs..."
              className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0"
              autoFocus
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setQuery("");
                  fetchGifs("");
                }}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          {/* GIF grid */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : gifs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                {query ? "No GIFs found" : "Search for GIFs"}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelect(gif)}
                    className="relative rounded-lg overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer bg-muted/30"
                    style={{
                      aspectRatio: `${gif.width} / ${gif.height}`,
                    }}
                  >
                    <img
                      src={gif.previewUrl}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Giphy attribution */}
          <div className="flex items-center justify-center py-1.5 border-t border-border">
            <span className="text-[9px] text-muted-foreground/50">
              Powered by GIPHY
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
