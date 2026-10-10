import React, { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

export default function QuoteModal({ onClose }) {
  const [countdown, setCountdown] = useState(4);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    if (countdown <= 0) {
      handleClose();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, handleClose]);

  const R = 10;
  const C = 2 * Math.PI * R;
  const pct = countdown / 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(10, 12, 16, 0.8)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
          opacity: visible ? 1 : 0,
        }}
        className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#161a25] p-7 shadow-2xl shadow-black/80"
      >
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-amber-500/20 via-amber-400 to-amber-500/20" />

        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
            <TrendingUp className="h-6 w-6 text-amber-400" />
          </div>
        </div>

        <blockquote className="mb-3 text-center">
          <p className="text-base sm:text-lg font-bold leading-snug tracking-tight text-white">
            &ldquo;Trend is your best friend.
            <br />
            <span className="text-amber-400 font-extrabold">Protect your capital first.</span>&rdquo;
          </p>
        </blockquote>
        <p className="mb-6 text-center text-xs text-zinc-500">
          XAU/USD · Precision Gold Trading System
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleClose}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-950/40 transition-all hover:brightness-110 active:scale-95"
          >
            Launch Trading Terminal
          </button>

          <div className="relative flex items-center justify-center" title={`Auto-closing in ${countdown}s`}>
            <svg width="28" height="28" viewBox="0 0 24 24" className="-rotate-90">
              <circle cx="12" cy="12" r={R} fill="none" stroke="#2a2e39" strokeWidth="2.5" />
              <circle
                cx="12"
                cy="12"
                r={R}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>
            <span className="absolute text-[9.5px] font-bold tabular-nums text-zinc-400">{countdown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
