// ============================================================
// Logo — Whispr inline SVG logo (chat bubble with "w" mark)
// ============================================================

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-label="Whispr logo"
    >
      <defs>
        <linearGradient id="whispr-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect x="56" y="56" width="400" height="340" rx="72" ry="72" fill="url(#whispr-bg)" />
      <path d="M100 370 L100 440 L170 370" fill="url(#whispr-bg)" />
      <polyline
        points="150,180 195,320 256,220 317,320 362,180"
        fill="none"
        stroke="white"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
