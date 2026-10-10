import React, { useState } from "react";
import {
  CheckSquare,
  Square,
  ListChecks,
  Plus,
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { DEFAULT_CHECKLIST, uid } from "../utils/constants";

export default function TradingChecklist({
  checklist = DEFAULT_CHECKLIST,
  onChangeChecklist,
  onInsertToNote,
  onClose,
  isFloating = false,
}) {
  const [newItemText, setNewItemText] = useState("");

  const items = Array.isArray(checklist) && checklist.length > 0
    ? checklist
    : DEFAULT_CHECKLIST;

  const total = items.length;
  const checkedCount = items.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const isAllChecked = total > 0 && checkedCount === total;

  const toggleItem = (id) => {
    if (!onChangeChecklist) return;
    const next = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    onChangeChecklist(next);
  };

  const addItem = (e) => {
    e?.preventDefault();
    const text = newItemText.trim();
    if (!text || !onChangeChecklist) return;
    const next = [...items, { id: uid(), text, checked: false }];
    onChangeChecklist(next);
    setNewItemText("");
  };

  const deleteItem = (id) => {
    if (!onChangeChecklist) return;
    const next = items.filter((item) => item.id !== id);
    onChangeChecklist(next);
  };

  const resetAll = () => {
    if (!onChangeChecklist) return;
    const next = items.map((item) => ({ ...item, checked: false }));
    onChangeChecklist(next);
  };

  const restoreDefaults = () => {
    if (!onChangeChecklist) return;
    onChangeChecklist(DEFAULT_CHECKLIST.map((item) => ({ ...item, id: uid() })));
  };

  const handleInsertSummary = () => {
    if (!onInsertToNote) return;
    const lines = items.map((i) => `  ${i.checked ? "☑" : "☐"} ${i.text}`);
    const summary = `
═══════════════════════════════════════════
  📋 TRADE EXECUTION CHECKLIST (${checkedCount}/${total} - ${pct}%)
═══════════════════════════════════════════
${lines.join("\n")}
───────────────────────────────────────────
Status: ${isAllChecked ? "⚡ VERIFIED — READY FOR EXECUTION" : "⚠️ UNCONFIRMED — INCOMPLETE RULES"}
`;
    onInsertToNote(summary);
  };

  return (
    <div
      className={`flex flex-col bg-[#141822] text-zinc-100 border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden select-none ${
        isFloating ? "w-88 sm:w-96 max-h-[90vh]" : "w-full h-full"
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] bg-[#1a1e2b] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Trading Execution Rules
            </h3>
            <p className="text-[10px] text-zinc-400">
              Pre-flight Trade Confluence Check
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetAll}
            title="Uncheck all rules"
            className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Progress & Status Bar ── */}
      <div className="border-b border-[#2a2e39] bg-[#12151f] px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-zinc-300">Confluence Progress:</span>
          <span
            className={`font-mono font-bold text-xs ${
              isAllChecked
                ? "text-emerald-400"
                : pct >= 50
                ? "text-amber-400"
                : "text-zinc-400"
            }`}
          >
            {checkedCount} / {total} Rules ({pct}%)
          </span>
        </div>

        {/* Progress Track */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
          <div
            className={`h-full transition-all duration-300 ${
              isAllChecked
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]"
                : pct >= 50
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-zinc-600"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Confirmation banner */}
        <div className="mt-2.5">
          {isAllChecked ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 shadow-sm animate-pulse">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold tracking-tight">
                All rules confirmed! Ready for trade entry.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />
              <span>
                {total - checkedCount} rule{total - checkedCount > 1 ? "s" : ""} missing. Protect capital: verify all confluences.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Checklist Items List ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`group flex items-start gap-2.5 rounded-lg p-2 transition-all cursor-pointer border ${
              item.checked
                ? "bg-emerald-950/20 border-emerald-500/30 text-zinc-200"
                : "bg-[#181c27]/60 border-transparent hover:bg-[#1f2433] hover:border-zinc-700/60 text-zinc-400"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {item.checked ? (
                <CheckSquare className="h-4 w-4 text-emerald-400" />
              ) : (
                <Square className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300" />
              )}
            </div>

            <span
              className={`flex-1 text-xs leading-relaxed transition-colors ${
                item.checked
                  ? "line-through text-zinc-400 font-normal"
                  : "font-medium text-zinc-200"
              }`}
            >
              {item.text}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteItem(item.id);
              }}
              title="Delete rule"
              className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-zinc-500">
            No checklist items. Click below to add or restore defaults.
          </div>
        )}
      </div>

      {/* ── Add New Item Form ── */}
      <form onSubmit={addItem} className="border-t border-[#2a2e39] bg-[#161a25] p-3 flex gap-2">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Add custom execution rule…"
          className="flex-1 rounded-lg border border-[#2a2e39] bg-[#0e1118] px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <button
          type="submit"
          className="cursor-pointer flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add</span>
        </button>
      </form>

      {/* ── Footer Actions ── */}
      <div className="border-t border-[#2a2e39] bg-[#12151f] p-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={restoreDefaults}
          className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300 underline"
        >
          Reset to default rules
        </button>

        {onInsertToNote && (
          <button
            type="button"
            onClick={handleInsertSummary}
            className="cursor-pointer flex items-center gap-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-zinc-700 transition-colors"
          >
            <PlusCircle className="h-3 w-3" />
            <span>Insert to Note</span>
          </button>
        )}
      </div>
    </div>
  );
}
