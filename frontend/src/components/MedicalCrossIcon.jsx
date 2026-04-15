/**
 * MedicalCrossIcon — reusable green medical cross avatar.
 * size: pixel size of the outer circle (default 36)
 * className: extra classes on the outer wrapper
 */
export default function MedicalCrossIcon({ size = 36, className = "" }) {
  const cross = Math.round(size * 0.6);
  return (
    <div
      className={`rounded-full bg-sky-500 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={cross}
        height={cross}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Medical cross"
      >
        <rect x="9" y="2" width="6" height="20" rx="2" fill="white" />
        <rect x="2" y="9" width="20" height="6" rx="2" fill="white" />
      </svg>
    </div>
  );
}
