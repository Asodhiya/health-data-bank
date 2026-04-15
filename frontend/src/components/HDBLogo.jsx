/**
 * HDBLogo — brand logo combining the ECG line icon + "Health Data Bank" wordmark.
 * size: "sm" | "md" | "lg"
 * as: "link" (default, wraps in <a> or Link) | "div"
 */
import { Link } from "react-router-dom";

function LogoIcon({ px = 32 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hdb-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <clipPath id="hdb-clip">
          <rect x="4" y="4" width="56" height="56" rx="14" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#hdb-bg)" />
      {/* Subtle top sheen */}
      <rect x="4" y="4" width="56" height="28" rx="14" fill="white" fillOpacity="0.08" />

      {/* ECG line — upper half */}
      <g clipPath="url(#hdb-clip)">
        <polyline
          points="4,30 14,30 18,18 23,40 27,24 31,33 34,28 38,28 42,30 60,30"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.95"
        />
      </g>

      {/* Divider */}
      <line x1="12" y1="40" x2="52" y2="40" stroke="white" strokeWidth="0.75" strokeOpacity="0.3" />

      {/* HDB text — lower half */}
      <text
        x="32"
        y="54"
        textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="13"
        letterSpacing="1.5"
        fill="white"
        fillOpacity="0.97"
      >
        HDB
      </text>
    </svg>
  );
}

const SIZE = {
  sm: { px: 28, text: "text-base", gap: "gap-2" },
  md: { px: 32, text: "text-lg",   gap: "gap-2.5" },
  lg: { px: 40, text: "text-2xl",  gap: "gap-3" },
};

export default function HDBLogo({ size = "md", to, className = "" }) {
  const { px, text, gap } = SIZE[size] ?? SIZE.md;

  const inner = (
    <span className={`flex items-center ${gap} ${className}`}>
      <LogoIcon px={px} />
      <span className={`font-extrabold tracking-tight text-blue-700 leading-tight ${text}`}>
        Health <span className="text-sky-500">Data</span> Bank
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }

  return inner;
}
