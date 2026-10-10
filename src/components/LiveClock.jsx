import React, { useEffect, useState } from "react";

/**
 * Returns true when local clock at tz is inside [openH:openM ... closeH:closeM].
 */
function isSessionOpen(time, tz, openH, openM, closeH, closeM) {
  try {
    const localStr = time.toLocaleString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [h, m] = localStr.split(":").map(Number);
    const mins = h * 60 + m;
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    return mins >= openMins && mins < closeMins;
  } catch {
    return false;
  }
}

export default function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (tz) => {
    try {
      return time.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--:--";
    }
  };

  // London: 08:00–16:30 local | NY: 08:00–17:00 local
  const ldnOpen = isSessionOpen(time, "Europe/London", 8, 0, 16, 30);
  const nyOpen = isSessionOpen(time, "America/New_York", 8, 0, 17, 0);

  const sessions = [
    {
      label: "UTC",
      tz: "UTC",
      active: false,
      title: "Coordinated Universal Time (Trading Benchmark)",
    },
    {
      label: "LDN",
      tz: "Europe/London",
      active: ldnOpen,
      title: ldnOpen ? "London session OPEN (High Gold Volatility)" : "London session closed",
    },
    {
      label: "NY",
      tz: "America/New_York",
      active: nyOpen,
      title: nyOpen ? "New York session OPEN (Peak Gold Volume)" : "New York session closed",
    },
  ];

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 select-none">
      {/* Subtle inline clock displays */}
      <div className="flex items-center gap-2.5 sm:gap-3 px-2.5 py-1 rounded-md bg-[#181c28]/70 border border-[#262b3a]/70 shrink-0">
        {sessions.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 shrink-0"
            title={s.title}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                s.active
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider shrink-0 transition-colors ${
                s.active ? "text-emerald-400" : "text-zinc-400"
              }`}
            >
              {s.label}
            </span>
            <span
              className={`font-mono text-[11px] font-semibold tabular-nums shrink-0 transition-colors ${
                s.active ? "text-emerald-300 font-bold" : "text-zinc-300"
              }`}
            >
              {fmt(s.tz)}
            </span>
          </div>
        ))}
      </div>

      {/* Active Session Status Badge */}
      {(ldnOpen || nyOpen) && (
        <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap shadow-sm shadow-emerald-950/40">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
          {ldnOpen && nyOpen
            ? "LDN + NY Overlap (Max Volume)"
            : ldnOpen
            ? "LDN Session Active"
            : "NY Session Active"}
        </span>
      )}
    </div>
  );
}
