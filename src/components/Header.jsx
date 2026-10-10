import React from "react";
import {
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  Calculator,
  ListChecks,
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
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#2a2e39] bg-[#141822] px-3.5 select-none z-30">
      {/* ── Left: Sidebar Toggle & Brand ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse Explorer (Ctrl+B)" : "Expand Explorer"}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-[#1f2433] hover:text-white"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/40 shadow-sm shadow-amber-950/40">
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black tracking-tight text-white">
              XAU<span className="text-amber-400">/USD</span>
            </span>
            <span className="hidden md:inline text-[11px] font-semibold text-zinc-400">
              Trading Terminal
            </span>
          </div>
        </div>
      </div>

      {/* ── Center: Multi-session Live Market Clocks ── */}
      <LiveClock />

      {/* ── Right: Widget Toggles & Cloud Sync Indicator ── */}
      <div className="flex items-center gap-2">
        {/* Risk Calculator Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleCalculator}
          title="Risk & Lot Size Calculator"
          className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
            calculatorOpen
              ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm"
              : "border-zinc-800 bg-[#1a1e2b] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <Calculator className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden sm:inline">Calculator</span>
        </button>

        {/* Execution Checklist Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleChecklist}
          title="Trade Confirmation Checklist"
          className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
            checklistOpen
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm"
              : "border-zinc-800 bg-[#1a1e2b] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Checklist</span>
        </button>

        {/* Drawing Canvas Toggle */}
        <button
          type="button"
          onClick={onToggleCanvas}
          title={canvasOpen ? "Hide Drawing Canvas" : "Show Drawing Canvas"}
          className={`cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
            canvasOpen
              ? "bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sm"
              : "border-zinc-800 bg-[#1a1e2b] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <PenTool className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden sm:inline">Canvas</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

        {/* Cloud Sync Status Badge */}
        {syncStatus === "saving" ? (
          <div
            className="flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5"
            title="Auto-saving trade notebook to Firebase Firestore..."
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
              Saving…
            </span>
          </div>
        ) : syncStatus === "offline" ? (
          <div
            className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5"
            title="Operating offline — LocalStorage backup active"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Offline
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5"
            title="All setups, drawings, and rules synced with Firebase Cloud"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 hidden sm:inline">
              Cloud Synced
            </span>
          </div>
        )}

        {/* Live Indicator */}
        <div className="flex items-center gap-1 rounded-full bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
