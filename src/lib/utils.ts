import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CONFIG } from "@/lib/constants";

// ============================================================
// shadcn utility
// ============================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Date / time formatting
// ============================================================

/** Format a timestamp to a short time string (e.g. "2:34 PM") */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================
// Input sanitization (client-side)
// ============================================================

/** Strip control characters, trim, and enforce max length for display names */
export function sanitizeName(name: string): string {
  return name
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, CONFIG.NAME_MAX_LENGTH);
}

/** Strip control characters from a text message, enforce max length */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, CONFIG.TEXT_MAX_LENGTH);
}

// ============================================================
// Image compression
// ============================================================

/**
 * Compress an image file to WebP, capped at IMAGE_MAX_WIDTH.
 * Returns a base64 data-URL string (e.g. "data:image/webp;base64,...").
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > CONFIG.IMAGE_MAX_WIDTH) {
        height = Math.round((height * CONFIG.IMAGE_MAX_WIDTH) / width);
        width = CONFIG.IMAGE_MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/webp", CONFIG.IMAGE_QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
