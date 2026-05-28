import { ReactNode, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut } from "lucide-react";

// ── Deterministic star generator ─────────────────────────────────────────────
// Uses a seeded LCG so the star field is always identical (no hydration flash).
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;   // 0–100 vw %
  y: number;   // 0–100 vh %
  r: number;   // radius px
  opacity: number;
  delay: number;  // animation-delay s
  dur: number;    // animation-duration s
}

function generateStars(count: number): Star[] {
  const rand = mulberry32(0xdeadbeef);
  return Array.from({ length: count }, () => ({
    x:       rand() * 100,
    y:       rand() * 100,
    r:       rand() * 1.4 + 0.4,           // 0.4 – 1.8 px
    opacity: rand() * 0.55 + 0.25,         // 0.25 – 0.80
    delay:   -(rand() * 8),                // stagger so they don't pulse together
    dur:     rand() * 4 + 3,               // 3 – 7 s cycle
  }));
}

// ── Component ────────────────────────────────────────────────────────────────
export default function StarfieldLayout({ children }: { children: ReactNode }) {
  const { facilitator, logout } = useAuth();
  const navigate = useNavigate();
  const stars = useMemo(() => generateStars(260), []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="starfield-root min-h-screen flex flex-col" style={{ background: "#000010" }}>
      {/* ── Star canvas ─────────────────────────────────────────────────────── */}
      <svg
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <defs>
          <style>{`
            @keyframes twinkle {
              0%, 100% { opacity: var(--op); }
              50%       { opacity: calc(var(--op) * 0.25); }
            }
          `}</style>
        </defs>
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="white"
            style={{
              "--op": s.opacity,
              opacity: s.opacity,
              animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}
      </svg>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{ background: "rgba(0,0,20,0.75)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-10"
      >
        <Link to="/" className="flex items-center gap-2">
          {/* Logo mark stays teal; swap wordmark text to white for legibility */}
          <div className="flex items-center gap-2 h-7">
            <svg viewBox="0 0 40 40" className="h-full w-auto flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="6" fill="#009999" />
              <path d="M26.5 13C26.5 11.067 24.933 9.5 23 9.5H14.5V16.5H23C23.828 16.5 24.5 17.172 24.5 18C24.5 18.828 23.828 19.5 23 19.5H17C15.067 19.5 13.5 21.067 13.5 23V27C13.5 28.933 15.067 30.5 17 30.5H25.5V23.5H17C16.172 23.5 15.5 22.828 15.5 22C15.5 21.172 16.172 20.5 17 20.5H23C24.933 20.5 26.5 18.933 26.5 17V13Z" fill="white" />
            </svg>
            <span className="font-bold tracking-widest uppercase select-none leading-none" style={{ color: "#ffffff", fontSize: "1.05rem", letterSpacing: "0.18em" }}>
              Siemens
            </span>
          </div>
        </Link>
        {facilitator && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">{facilitator.email}</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="relative z-[1] flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}
