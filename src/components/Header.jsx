import React from "react";
import {
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  Calculator,
  PenTool,
} from "lucide-react";
import LiveClock from "./LiveClock";

export default function Header({
  sidebarOpen,
  canvasOpen,
  checklistOpen,
  calculatorOpen,
  onToggleSidebar,
  onToggleCanvas,
  onToggleChecklist,
  onToggleCalculator,
  syncStatus = "synced",
}) {
  return (
    <header className="flex items-center justify-between w-full px-4 h-14 bg-[#131722] border-b border-[#2a2e39] flex-nowrap gap-3 overflow-x-auto select-none z-30 shrink-0">
      {/* ── Left: Sidebar Toggle & Brand ── */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse Explorer (Ctrl+B)" : "Expand Explorer"}
          className="cursor-pointer shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-[#1e222d] hover:text-white border border-transparent hover:border-[#2a2e39]"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/40 shadow-sm shadow-amber-950/40">
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-sm font-black tracking-tight text-white whitespace-nowrap">
              XAU<span className="text-amber-400">/USD</span>
            </span>
            <span className="hidden md:inline text-[11px] font-semibold text-zinc-400 whitespace-nowrap">
              Trading Terminal
            </span>
          </div>
        </div>
      </div>

      {/* ── Center: Multi-session Live Market Clocks ── */}
      <LiveClock />

      {/* ── Right: Widget Toggles & Status Indicators ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Risk Calculator Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleCalculator}
          title="Risk & Lot Size Calculator"
          className={`cursor-pointer shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-all ${
            calculatorOpen
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
              : "border-[#2a2e39] bg-[#1a1e29] text-zinc-300 hover:bg-[#242835] hover:text-white hover:border-[#363a45]"
          }`}
        >
          <Calculator className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="shrink-0">Calculator</span>
        </button>

        {/* Drawing Canvas Toggle */}
        <button
          type="button"
          onClick={onToggleCanvas}
          title={canvasOpen ? "Hide Drawing Canvas" : "Show Drawing Canvas"}
          className={`cursor-pointer shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-all ${
            canvasOpen
              ? "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-sm"
              : "border-[#2a2e39] bg-[#1a1e29] text-zinc-300 hover:bg-[#242835] hover:text-white hover:border-[#363a45]"
          }`}
        >
          <PenTool className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="shrink-0">Canvas</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-[#2a2e39] mx-1 shrink-0" />

        {/* Cloud Sync Status Badge */}
        {syncStatus === "saving" ? (
          <div
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-500/40 px-2.5 py-1"
            title="Auto-saving trade notebook to Firebase Firestore..."
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 whitespace-nowrap">
              Saving…
            </span>
          </div>
        ) : syncStatus === "offline" ? (
          <div
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-1"
            title="Operating offline — LocalStorage backup active"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
              Offline
            </span>
          </div>
        ) : (
          <div
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1"
            title="All setups, drawings, and rules synced with Firebase Cloud"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap">
              Cloud Synced
            </span>
          </div>
        )}

        {/* Live Indicator */}
        <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap">
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
