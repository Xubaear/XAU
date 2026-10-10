import React, { useRef, useState } from "react";
import { FileText } from "lucide-react";
import RichNoteEditor from "../RichNoteEditor";
import TagManager from "./TagManager";
import { fmtTs, nowTs } from "../utils/constants";

export default function NoteEditor({
  note,
  onUpdateTitle,
  onUpdateContent,
  onAddTag,
  onRemoveTag,
}) {
  const saveTimer = useRef(null);
  const [localSavedTs, setLocalSavedTs] = useState(null);
  const [pulse, setPulse] = useState(false);
  const displaySaved = localSavedTs || note?.updatedAt;

  const handleContent = (val) => {
    const nextVal = typeof val === "string" ? val : val?.target?.value ?? "";
    onUpdateContent(nextVal);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setLocalSavedTs(nowTs());
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
    }, 500);
  };

  if (!note) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#131722] text-zinc-500">
        <FileText className="mb-3 h-14 w-14 text-zinc-700" />
        <p className="text-sm font-semibold text-zinc-400">No trading setup selected</p>
        <p className="mt-1 text-xs text-zinc-600">
          Select a setup from the explorer on the left or create a new one.
        </p>
      </div>
    );
  }

  const plainText = (note.content || "").replace(/<[^>]+>/g, " ");
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const chars = plainText.length;

  return (
    <div className="flex h-full flex-col bg-[#131722] overflow-hidden">
      {/* ── Setup Header: Title, Tags, Timestamps ── */}
      <div className="border-b border-[#2a2e39] bg-[#161a25] px-6 py-3.5 space-y-2">
        <input
          type="text"
          value={note.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Setup Title (e.g. London Breakout, Asian Sweep Retest)…"
          className="w-full bg-transparent text-xl font-bold tracking-tight text-white placeholder-zinc-600 outline-none"
        />

        {/* Tag Manager */}
        <TagManager
          tags={note.tags || []}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />

        {/* Setup Metadata bar */}
        <div className="flex items-center gap-3 text-[10.5px] text-zinc-500 font-mono">
          <span
            className={`flex items-center gap-1.5 transition-colors ${
              pulse ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                pulse ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-600"
              }`}
            />
            Saved {fmtTs(displaySaved)}
          </span>
          <span className="text-zinc-700">·</span>
          <span>{words} words</span>
          <span className="text-zinc-700">·</span>
          <span>{chars} characters</span>
        </div>
      </div>

      {/* ── Rich Text Strategy Editor ── */}
      <RichNoteEditor
        key={note.id}
        value={note.content}
        onChange={handleContent}
        placeholder="Document your setup: Market bias, Support/Resistance levels, Fair Value Gaps, Entry trigger, Stop Loss, Target confluences…"
      />
    </div>
  );
}
