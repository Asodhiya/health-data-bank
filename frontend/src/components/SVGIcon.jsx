// Shared SVG icon wrapper used by participant pages.
// `d` accepts either a path string (auto-wrapped in <path>) or arbitrary JSX
// (for multi-shape icons — circles, lines, etc.).

export default function SVGIcon({
  d,
  size = 20,
  sw = 1.8,
  stroke = "currentColor",
  fill = "none",
  ...rest
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}
