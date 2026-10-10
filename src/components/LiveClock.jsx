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

  // London: 08:00–16:30 local | NY: 08:00–17:00 local | Tokyo: 09:00–15:00 local
  const ldnOpen = isSessionOpen(time, "Europe/London", 8, 0, 16, 30);
  const nyOpen = isSessionOpen(time, "America/New_York", 8, 0, 17, 0);
  const tkyOpen = isSessionOpen(time, "Asia/Tokyo", 9, 0, 15, 0);

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
    {
      label: "TKY",
      tz: "Asia/Tokyo",
      active: tkyOpen,
      title: tkyOpen ? "Tokyo session OPEN (Asian Session Range)" : "Tokyo session closed",
    },
    {
      label: "BD",
      tz: "Asia/Dhaka",
      active: false,
      title: "Bangladesh Standard Time (UTC+6)",
    },
  ];

  return (
    <div className="hidden items-center gap-3.5 xl:flex select-none">
      {sessions.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5" title={s.title}>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
              s.active
                ? "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.8)] animate-pulse"
                : "bg-zinc-700"
            }`}
          />
          <span
            className={`text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
              s.active ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            {s.label}
          </span>
          <span
            className={`font-mono text-[11px] font-semibold tabular-nums transition-colors ${
              s.active ? "text-emerald-300 font-bold" : "text-amber-400/90"
            }`}
          >
            {fmt(s.tz)}
          </span>
        </div>
      ))}

      {/* Active Session Status Badge */}
      {(ldnOpen || nyOpen || tkyOpen) && (
        <span className="ml-1 flex items-center gap-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 shadow-sm shadow-emerald-900/30">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
          {ldnOpen && nyOpen
            ? "LDN + NY Overlap (Max Volume)"
            : ldnOpen
            ? "LDN Session Active"
            : nyOpen
            ? "NY Session Active"
            : "Tokyo Session Active"}
        </span>
      )}
    </div>
  );
}
