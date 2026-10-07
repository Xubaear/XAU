import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  RemoveFormatting,
  Type,
  Palette,
  Check,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION: SIZES & HIGHLIGHT COLORS
// ─────────────────────────────────────────────────────────────────────────────
const FONT_SIZES = [
  { id: "sm", label: "Small",   sizeCss: "11px", cmdValue: "1", desc: "11px" },
  { id: "md", label: "Normal",  sizeCss: "14px", cmdValue: "3", desc: "14px" },
  { id: "lg", label: "Large",   sizeCss: "18px", cmdValue: "5", desc: "18px" },
  { id: "xl", label: "XL",      sizeCss: "24px", cmdValue: "7", desc: "24px" },
];

const HIGHLIGHT_COLORS = [
  { id: "gold",    label: "Gold / Yellow",  hex: "#f59e0b", dotClass: "bg-amber-500", ring: "hover:ring-amber-500/50" },
  { id: "bullish", label: "Bullish Green",  hex: "#22c55e", dotClass: "bg-green-500", ring: "hover:ring-green-500/50" },
  { id: "bearish", label: "Bearish Red",    hex: "#ef4444", dotClass: "bg-red-500",   ring: "hover:ring-red-500/50" },
  { id: "sky",     label: "Sky Blue",       hex: "#38bdf8", dotClass: "bg-sky-400",   ring: "hover:ring-sky-400/50" },
  { id: "white",   label: "Default White",  hex: "#f8fafc", dotClass: "bg-slate-100", ring: "hover:ring-slate-100/50" },
];

/**
 * RichNoteEditor — Standalone drop-in rich-text editor for XAU/USD Trading Dashboard
 * 
 * Props:
 *  - value: string (HTML or plain text)
 *  - onChange: (newHtml: string) => void
 *  - placeholder?: string
 *  - className?: string
 */
export default function RichNoteEditor({
  value = "",
  onChange,
  placeholder = "Write your trading plan, rules, entry/exit parameters, observations…",
  className = "",
}) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef(value);
  const [activeSize, setActiveSize] = useState("md");

  // ── Sync external value without clobbering cursor/selection ────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    // Only update DOM innerHTML if content is genuinely different from what we last emitted
    if (value !== lastHtmlRef.current) {
      editorRef.current.innerHTML = value || "";
      lastHtmlRef.current = value || "";
    }
  }, [value]);

  // Initial load
  useEffect(() => {
    if (editorRef.current && value && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
      lastHtmlRef.current = value;
    }
  }, []);

  // ── Emit changes to parent ──────────────────────────────────────────────────
  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    lastHtmlRef.current = newHtml;
    if (onChange) {
      onChange(newHtml);
    }
  }, [onChange]);

  // ── Execute standard document.execCommand ──────────────────────────────────
  const executeCmd = (command, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(command, false, val);
    } catch (e) {
      console.warn("execCommand failed:", e);
    }
    emitChange();
  };

  // ── Apply inline styling (Font Size / Custom Span) to selected text ─────────
  const applyInlineSpan = (styles, cmdFallback = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    // Ensure selection is inside this editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    try {
      const span = document.createElement("span");
      Object.assign(span.style, styles);

      // Extract only the selected keywords and wrap them
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);

      // Keep the selection around the newly formatted keyword
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch (err) {
      // Fallback to execCommand if DOM extraction had an edge case
      if (cmdFallback) {
        cmdFallback();
      }
    }

    emitChange();
  };

  // ── Format Handlers ─────────────────────────────────────────────────────────
  const handleToggleBold = () => executeCmd("bold");
  const handleToggleItalic = () => executeCmd("italic");

  const handleApplyColor = (hex) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    // Use execCommand foreColor with styleWithCSS for seamless keyword styling
    try {
      document.execCommand("styleWithCSS", false, true);
      const ok = document.execCommand("foreColor", false, hex);
      if (!ok) {
        applyInlineSpan({ color: hex });
      }
    } catch {
      applyInlineSpan({ color: hex });
    }
    emitChange();
  };

  const handleApplyFontSize = (sizeObj) => {
    setActiveSize(sizeObj.id);
    applyInlineSpan(
      { fontSize: sizeObj.sizeCss, lineHeight: "1.4" },
      () => executeCmd("fontSize", sizeObj.cmdValue)
    );
  };

  const handleClearFormat = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    executeCmd("removeFormat");
    // Also strip custom font-size or color wrappers in selection if any
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const parent = range.commonAncestorContainer.parentElement;
      if (parent && parent !== editorRef.current && parent.tagName === "SPAN") {
        parent.style.color = "";
        parent.style.fontSize = "";
      }
    }
    emitChange();
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-zinc-950 text-zinc-100 ${className}`}>
      {/* ── SLEEK DARK TRADING TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-6 py-2.5 bg-zinc-900/60 border-b border-zinc-800/80 select-none">
        
        {/* Bold & Italic */}
        <div className="flex items-center gap-0.5 bg-zinc-950/70 p-0.5 rounded border border-zinc-800/80">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Keeps text selection intact!
            onClick={handleToggleBold}
            title="Bold (Ctrl+B)"
            className="flex items-center justify-center h-6 w-6 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/90 transition-colors font-bold text-xs"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Keeps text selection intact!
            onClick={handleToggleItalic}
            title="Italic (Ctrl+I)"
            className="flex items-center justify-center h-6 w-6 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/90 transition-colors italic text-xs"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Font Size Pills */}
        <div className="flex items-center gap-1 bg-zinc-950/70 p-0.5 rounded border border-zinc-800/80">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 px-1 flex items-center gap-1">
            <Type className="h-2.5 w-2.5" />
            Size
          </span>
          {FONT_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // Keeps text selection intact!
              onClick={() => handleApplyFontSize(s)}
              title={`${s.label} (${s.desc})`}
              className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-all ${
                activeSize === s.id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Color Highlights */}
        <div className="flex items-center gap-1 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800/80">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 pr-1 flex items-center gap-1">
            <Palette className="h-2.5 w-2.5" />
            Color
          </span>
          <div className="flex items-center gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // Keeps text selection intact!
                onClick={() => handleApplyColor(c.hex)}
                title={c.label}
                className={`group relative flex items-center justify-center h-5 w-5 rounded-full transition-transform hover:scale-110 active:scale-95 border border-zinc-700/60 hover:ring-2 ${c.ring}`}
              >
                <span className={`h-3 w-3 rounded-full ${c.dotClass} shadow-sm`} />
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClearFormat}
          title="Clear formatting on selection"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors border border-transparent hover:border-zinc-800"
        >
          <RemoveFormatting className="h-3 w-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>

      </div>

      {/* ── CONTENT EDITABLE CANVAS AREA ── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={emitChange}
          onBlur={emitChange}
          data-placeholder={placeholder}
          className="rich-editor-content w-full min-h-full px-6 py-5 font-mono text-sm leading-7 text-zinc-300 outline-none whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-700 empty:before:pointer-events-none focus:ring-0"
        />
      </div>

      {/* Editor CSS adjustments */}
      <style>{`
        .rich-editor-content:empty::before {
          content: attr(data-placeholder);
          color: #3f3f46;
          pointer-events: none;
        }
        .rich-editor-content font[size="1"], .rich-editor-content span[style*="11px"] { font-size: 11px; }
        .rich-editor-content font[size="3"], .rich-editor-content span[style*="14px"] { font-size: 14px; }
        .rich-editor-content font[size="5"], .rich-editor-content span[style*="18px"] { font-size: 18px; }
        .rich-editor-content font[size="7"], .rich-editor-content span[style*="24px"] { font-size: 24px; font-weight: 600; }
      `}</style>
    </div>
  );
}
