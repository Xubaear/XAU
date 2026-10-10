import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  RemoveFormatting,
  Type,
  Palette,
  Image as ImageIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION: SIZES & HIGHLIGHT COLORS
// ─────────────────────────────────────────────────────────────────────────────
const FONT_SIZES = [
  { id: "sm", label: "Small",   sizeCss: "11px", cmdValue: "1", desc: "11px" },
  { id: "md", label: "Normal",  sizeCss: "13.5px", cmdValue: "3", desc: "14px" },
  { id: "lg", label: "Large",   sizeCss: "17px", cmdValue: "5", desc: "17px" },
  { id: "xl", label: "XL",      sizeCss: "22px", cmdValue: "7", desc: "22px" },
];

const HIGHLIGHT_COLORS = [
  { id: "gold",    label: "Gold / Yellow",  hex: "#f59e0b", dotClass: "bg-amber-500", ring: "hover:ring-amber-500/50" },
  { id: "bullish", label: "Bullish Green",  hex: "#22c55e", dotClass: "bg-emerald-500", ring: "hover:ring-emerald-500/50" },
  { id: "bearish", label: "Bearish Red",    hex: "#ef4444", dotClass: "bg-rose-500",   ring: "hover:ring-rose-500/50" },
  { id: "sky",     label: "Sky Blue",       hex: "#38bdf8", dotClass: "bg-sky-400",   ring: "hover:ring-sky-400/50" },
  { id: "purple",  label: "Liquidity Purple",hex: "#a855f7", dotClass: "bg-purple-400", ring: "hover:ring-purple-400/50" },
  { id: "white",   label: "Default White",  hex: "#f8fafc", dotClass: "bg-slate-100", ring: "hover:ring-slate-100/50" },
];

export default function RichNoteEditor({
  value = "",
  onChange,
  placeholder = "Write your trading plan, rules, entry/exit parameters, observations…",
  className = "",
}) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastHtmlRef = useRef(value);
  const [activeSize, setActiveSize] = useState("md");

  // ── Sync external value without clobbering cursor ───────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
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

  // ── Execute document.execCommand ───────────────────────────────────────────
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

  // ── Apply inline styling (Font Size / Custom Span) ─────────────────────────
  const applyInlineSpan = (styles, cmdFallback = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    try {
      const span = document.createElement("span");
      Object.assign(span.style, styles);

      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch {
      if (cmdFallback) cmdFallback();
    }

    emitChange();
  };

  const handleToggleBold = () => executeCmd("bold");
  const handleToggleItalic = () => executeCmd("italic");

  const handleApplyColor = (hex) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
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
    emitChange();
  };

  // ── Insert Image element into Editor (with compression) ─────────────────────
  const insertImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Compress large screenshot to keep Firestore payload lean
        const canvas = document.createElement("canvas");
        const maxW = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        const compressedDataUrl = canvas.toDataURL("image/webp", 0.85);

        if (editorRef.current) {
          editorRef.current.focus();
          const imgElem = `<div class="chart-embed my-3 p-1 rounded-lg border border-zinc-700/80 bg-zinc-900/60 inline-block max-w-full"><img src="${compressedDataUrl}" alt="Chart Screenshot" class="rounded max-h-[500px] max-w-full object-contain" /></div><br/>`;
          document.execCommand("insertHTML", false, imgElem);
          emitChange();
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          insertImageFile(file);
        }
        return;
      }
    }
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-[#131722] text-zinc-100 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            insertImageFile(e.target.files[0]);
            e.target.value = "";
          }
        }}
        className="hidden"
      />

      {/* ── SLEEK DARK TRADING TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-[#181c27] border-b border-[#2a2e39] select-none">
        {/* Bold & Italic */}
        <div className="flex items-center gap-0.5 bg-[#12151f] p-0.5 rounded border border-[#2a2e39]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBold}
            title="Bold (Ctrl+B)"
            className="cursor-pointer flex items-center justify-center h-6 w-6 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-bold text-xs"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleItalic}
            title="Italic (Ctrl+I)"
            className="cursor-pointer flex items-center justify-center h-6 w-6 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors italic text-xs"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Font Size Pills */}
        <div className="flex items-center gap-1 bg-[#12151f] p-0.5 rounded border border-[#2a2e39]">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 px-1 flex items-center gap-1">
            <Type className="h-2.5 w-2.5" />
            Size
          </span>
          {FONT_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleApplyFontSize(s)}
              title={`${s.label} (${s.desc})`}
              className={`cursor-pointer px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-all ${
                activeSize === s.id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Color Highlights */}
        <div className="flex items-center gap-1 bg-[#12151f] px-1.5 py-0.5 rounded border border-[#2a2e39]">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 pr-1 flex items-center gap-1">
            <Palette className="h-2.5 w-2.5" />
            Color
          </span>
          <div className="flex items-center gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleApplyColor(c.hex)}
                title={c.label}
                className={`cursor-pointer group relative flex items-center justify-center h-5 w-5 rounded-full transition-transform hover:scale-110 active:scale-95 border border-zinc-700/60 hover:ring-2 ${c.ring}`}
              >
                <span className={`h-3 w-3 rounded-full ${c.dotClass} shadow-sm`} />
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5" />

        {/* Insert Image Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          title="Insert Chart Screenshot (or Ctrl+V to paste)"
          className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors border border-sky-500/30"
        >
          <ImageIcon className="h-3 w-3" />
          <span className="hidden sm:inline">Image</span>
        </button>

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClearFormat}
          title="Clear formatting on selection"
          className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ml-auto"
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
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className="rich-editor-content w-full min-h-full px-6 py-5 font-mono text-sm leading-7 text-zinc-300 outline-none whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 empty:before:pointer-events-none focus:ring-0"
        />
      </div>

      <style>{`
        .rich-editor-content:empty::before {
          content: attr(data-placeholder);
          color: #4b5563;
          pointer-events: none;
        }
        .rich-editor-content font[size="1"], .rich-editor-content span[style*="11px"] { font-size: 11px; }
        .rich-editor-content font[size="3"], .rich-editor-content span[style*="13.5px"] { font-size: 13.5px; }
        .rich-editor-content font[size="5"], .rich-editor-content span[style*="17px"] { font-size: 17px; }
        .rich-editor-content font[size="7"], .rich-editor-content span[style*="22px"] { font-size: 22px; font-weight: 700; }
        .rich-editor-content img {
          max-width: 100%;
          border-radius: 8px;
          border: 1px solid #2a2e39;
          margin: 8px 0;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
