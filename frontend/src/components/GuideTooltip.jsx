/**
 * GuideTooltip system — subtle hover hints for participant pages.
 * Toggle is on by default. Persisted to localStorage so it survives page refresh.
 * Tooltips render via a React portal so they are never clipped by overflow:hidden parents.
 * Final positions are computed in JS (no CSS transform) so clamping is exact.
 */
import { createContext, useContext, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const GuideContext = createContext({ guideEnabled: true, setGuideEnabled: () => {} });

export function GuideProvider({ children }) {
  const [guideEnabled, setGuideEnabled] = useState(() => {
    try { return localStorage.getItem("hdb_guide") !== "off"; } catch { return true; }
  });

  const toggle = (v) => {
    const next = typeof v === "boolean" ? v : !guideEnabled;
    setGuideEnabled(next);
    try { localStorage.setItem("hdb_guide", next ? "on" : "off"); } catch {}
  };

  return (
    <GuideContext.Provider value={{ guideEnabled, setGuideEnabled: toggle }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  return useContext(GuideContext);
}

// ── Slide Toggle Button ───────────────────────────────────────────────────────
export function GuideToggle() {
  const { guideEnabled, setGuideEnabled } = useGuide();
  const [tipVisible, setTipVisible] = useState(false);
  const [tipStyle, setTipStyle] = useState({});
  const btnRef = useRef(null);

  const showTip = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const W = 220;
    const TH = 40;
    const GAP = 8;
    let top = r.bottom + GAP;
    let left = r.right - W;
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8));
    top  = Math.max(70, Math.min(top, window.innerHeight - TH - 8));
    setTipStyle({ top, left, width: W });
    setTipVisible(true);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setGuideEnabled(!guideEnabled)}
        onMouseEnter={showTip}
        onMouseLeave={() => setTipVisible(false)}
        aria-label={guideEnabled ? "Hide page hints" : "Show page hints"}
        className="flex items-center gap-2 px-2 py-1 rounded-full transition-colors hover:bg-slate-100"
      >
        {/* Track */}
        <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${guideEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
          {/* Thumb */}
          <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200 ${guideEnabled ? "left-[18px]" : "left-0.5"}`} />
        </div>
        {/* Label */}
        <span className={`text-xs font-semibold hidden sm:inline transition-colors ${guideEnabled ? "text-blue-600" : "text-slate-400"}`}>
          Hints
        </span>
      </button>
      {tipVisible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: tipStyle.top, left: tipStyle.left, width: tipStyle.width }}
        >
          <div className="bg-slate-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg text-center leading-snug whitespace-normal">
            {guideEnabled ? "Hints on — hover elements for help" : "Turn on to see page hints"}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Portal Tooltip Wrapper ────────────────────────────────────────────────────
// W  = tooltip width in px
// TH = estimated tooltip height (px). Two lines of text ≈ 52px, one line ≈ 36px.
const W  = 220;
const TH = 52;
const GAP = 8;
const NAV_H = 68; // navbar height + small buffer so tooltips don't go behind it

function calcPos(r, preferredPos) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let pos = preferredPos;

  // Auto-flip if preferred direction has no room
  if (pos === "top"    && r.top - TH - GAP < NAV_H) pos = "bottom";
  if (pos === "bottom" && r.bottom + TH + GAP > vh - 8) pos = "top";
  if (pos === "left"   && r.left - W - GAP < 8) pos = "right";
  if (pos === "right"  && r.right + W + GAP > vw - 8) pos = "left";

  let top, left;
  switch (pos) {
    case "bottom":
      top  = r.bottom + GAP;
      left = r.left + r.width / 2 - W / 2;
      break;
    case "left":
      top  = r.top + r.height / 2 - TH / 2;
      left = r.left - GAP - W;
      break;
    case "right":
      top  = r.top + r.height / 2 - TH / 2;
      left = r.right + GAP;
      break;
    default: // top
      top  = r.top - GAP - TH;
      left = r.left + r.width / 2 - W / 2;
  }

  // Hard clamp to keep fully on-screen
  top  = Math.max(NAV_H, Math.min(top, vh - TH - 8));
  left = Math.max(8, Math.min(left, vw - W - 8));

  return { top, left };
}

export default function GuideTooltip({ tip, position = "top", children }) {
  const { guideEnabled } = useGuide();
  const [visible, setVisible] = useState(false);
  const [style, setStyle]     = useState({});
  const wrapperRef = useRef(null);

  const show = useCallback(() => {
    if (!wrapperRef.current) return;
    const { top, left } = calcPos(wrapperRef.current.getBoundingClientRect(), position);
    setStyle({ top, left });
    setVisible(true);
  }, [position]);

  const hide = useCallback(() => setVisible(false), []);

  if (!guideEnabled) return <>{children}</>;

  return (
    <>
      <div ref={wrapperRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </div>
      {visible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: style.top, left: style.left, width: W }}
        >
          <div className="bg-slate-700 text-white text-xs font-medium px-2.5 py-2 rounded-lg shadow-lg text-center leading-snug whitespace-normal">
            {tip}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
