"use client";

// ============================================================
// StatusBanner — shows connection, peer and encryption status
// ============================================================

interface StatusBannerProps {
  connected: boolean;
  peerConnected: boolean;
  peerName: string | null;
  roomFull: boolean;
  encrypted: boolean;
}

export default function StatusBanner({
  connected,
  peerConnected,
  peerName,
  roomFull,
  encrypted,
}: StatusBannerProps) {
  if (!connected) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm text-muted-foreground bg-muted rounded-lg">
        <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
        Connecting...
      </div>
    );
  }

  if (roomFull) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        <span className="size-1.5 rounded-full bg-destructive" />
        Room is full
      </div>
    );
  }

  if (!peerConnected) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm text-muted-foreground bg-muted rounded-lg">
        <span className="size-1.5 rounded-full bg-chart-1 animate-pulse" />
        Waiting for peer...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm text-muted-foreground bg-muted rounded-lg">
      <span className="size-1.5 rounded-full bg-primary" />
      <span>{peerName} connected</span>
      {encrypted && (
        <span className="text-primary ml-1">&middot; encrypted</span>
      )}
    </div>
  );
}
