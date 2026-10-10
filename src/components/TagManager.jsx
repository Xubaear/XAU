import React, { useState } from "react";
import { Hash, Plus, X } from "lucide-react";
import { PRESET_TAGS, getTagStyle } from "../utils/constants";

export function TagBadge({ tag, onRemove, onClick, selected = false, size = "sm" }) {
  const normalized = tag.startsWith("#") ? tag : `#${tag}`;
  const colorClass = getTagStyle(normalized);

  const sizeClasses =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-[11px] px-2 py-0.5 gap-1.5";

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-mono rounded-md border font-semibold transition-all select-none ${sizeClasses} ${
        selected ? "ring-1 ring-amber-400 bg-amber-500/25 text-amber-300 border-amber-400/50" : colorClass
      } ${onClick ? "cursor-pointer hover:brightness-125" : ""}`}
    >
      <span>{normalized}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(normalized);
          }}
          className="cursor-pointer text-zinc-400 hover:text-white rounded hover:bg-black/20 p-0.5 transition-colors"
          title={`Remove ${normalized}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

export default function TagManager({ tags = [], onAddTag, onRemoveTag }) {
  const [isAdding, setIsAdding] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const handleAdd = (tagName) => {
    let clean = tagName.trim();
    if (!clean) return;
    if (!clean.startsWith("#")) clean = `#${clean}`;
    if (!tags.includes(clean)) {
      onAddTag(clean);
    }
    setCustomTag("");
    setIsAdding(false);
  };

  const unusedPresets = PRESET_TAGS.filter(
    (p) => !tags.includes(p.name)
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 mr-1">
        <Hash className="h-3 w-3 text-amber-400/80" />
        <span>Tags:</span>
      </div>

      {tags.map((t) => (
        <TagBadge
          key={t}
          tag={t}
          onRemove={onRemoveTag ? () => onRemoveTag(t) : undefined}
        />
      ))}

      {isAdding ? (
        <div className="relative inline-flex items-center gap-1">
          <input
            type="text"
            autoFocus
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd(customTag);
              } else if (e.key === "Escape") {
                setIsAdding(false);
              }
            }}
            placeholder="#NewTag"
            className="w-24 rounded border border-amber-500/50 bg-[#1e222d] px-2 py-0.5 text-xs text-white placeholder-zinc-500 outline-none ring-1 ring-amber-500/30"
          />
          <button
            type="button"
            onClick={() => handleAdd(customTag)}
            className="cursor-pointer rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950 hover:bg-amber-400"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="cursor-pointer text-zinc-500 hover:text-zinc-300 text-xs px-1"
          >
            ✕
          </button>

          {/* Quick preset dropdown picker */}
          <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-zinc-700 bg-[#161a25] p-1.5 shadow-xl shadow-black/80">
            <p className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Suggestions:
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {unusedPresets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleAdd(p.name)}
                  className={`cursor-pointer rounded border px-1.5 py-0.5 text-[10px] font-mono transition-transform hover:scale-105 ${p.color}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-0.5 text-[10.5px] font-medium text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>Add Tag</span>
        </button>
      )}
    </div>
  );
}
