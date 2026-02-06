// ============================================================
// Sound Effects — Messenger-style sounds using Web Audio API
// ============================================================

let audioContext: AudioContext | null = null;

async function getAudioContext(): Promise<AudioContext> {
  if (typeof window === "undefined") {
    throw new Error("AudioContext not available in SSR");
  }
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported");
    }
    audioContext = new AudioContextClass();
  }
  // Resume audio context if suspended (browser autoplay policy)
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch (error) {
      // User interaction might be required
    }
  }
  return audioContext;
}


async function playWhooshSound(): Promise<void> {
  try {
    const ctx = await getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  } catch (error) {
    // Audio context might not be available
  }
}

async function playNotificationChime(): Promise<void> {
  try {
    const ctx = await getAudioContext();
    
    // Create two oscillators for a pleasant chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const masterGain = ctx.createGain();

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(masterGain);
    gain2.connect(masterGain);
    masterGain.connect(ctx.destination);

    // First tone: higher pitch
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);

    // Second tone: lower pitch, slightly delayed
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);

    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    masterGain.gain.value = 0.7;

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.02);
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  } catch (error) {
    // Audio context might not be available
  }
}

async function playTypingClick(): Promise<void> {
  try {
    const ctx = await getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.03);
  } catch (error) {
    // Audio context might not be available
  }
}

export function playMessageSentSound(): void {
  playWhooshSound().catch(() => {
    // Silently fail if audio context can't be resumed
  });
}

export function playMessageReceivedSound(): void {
  playNotificationChime().catch(() => {
    // Silently fail if audio context can't be resumed
  });
}

export function playTypingSound(): void {
  playTypingClick().catch(() => {
    // Silently fail if audio context can't be resumed
  });
}
