import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getTagStyle } from "../utils/constants";

// ─────────────────────────────────────────────────────────────────────────────
// INLINE RENAME INPUT
// ─────────────────────────────────────────────────────────────────────────────
function InlineEdit({ value, onCommit, onCancel }) {
  const [val, setVal] = useState(value);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 rounded bg-[#2a2e39] px-2 py-0.5 text-xs text-white outline-none ring-1 ring-amber-500/50 focus:ring-amber-400"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT MENU
// ─────────────────────────────────────────────────────────────────────────────
function ContextMenu({ items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-40 mt-1 min-w-[130px] rounded-xl border border-[#2a2e39] bg-[#1a1e2b] py-1 shadow-2xl shadow-black/80"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-800 ${
            item.danger
              ? "text-rose-400 hover:text-rose-300"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE ITEM
// ─────────────────────────────────────────────────────────────────────────────
function NoteItem({ note, isActive, onSelect, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`group relative flex cursor-pointer flex-col gap-1 rounded-lg px-2.5 py-2 text-xs transition-all border ${
        isActive
          ? "bg-amber-500/15 border-amber-500/30 text-amber-200 shadow-sm"
          : "border-transparent text-zinc-400 hover:bg-[#1f2433] hover:text-zinc-200"
      }`}
      onClick={() => {
        if (!renaming) onSelect();
      }}
    >
      <div className="flex items-center gap-2 w-full min-w-0">
        <FileText
          className={`h-3.5 w-3.5 shrink-0 ${
            isActive ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-300"
          }`}
        />

        {renaming ? (
          <InlineEdit
            value={note.title}
            onCommit={(v) => {
              onRename(v);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="flex-1 truncate font-medium text-xs">
            {note.title || "Untitled Setup"}
          </span>
        )}

        {!renaming && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`shrink-0 rounded p-0.5 transition-opacity ${
              menuOpen
                ? "opacity-100 text-zinc-200"
                : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Note tag chips preview */}
      {Array.isArray(note.tags) && note.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pl-5">
          {note.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className={`text-[9.5px] font-mono px-1 py-0.2 rounded border ${getTagStyle(
                t
              )}`}
            >
              {t}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-[9px] text-zinc-500">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {menuOpen && (
        <ContextMenu
          onClose={() => setMenuOpen(false)}
          items={[
            {
              label: "Rename Setup",
              icon: <Pencil className="h-3 w-3" />,
              action: () => setRenaming(true),
            },
            {
              label: "Delete Setup",
              icon: <Trash2 className="h-3 w-3" />,
              danger: true,
              action: onDelete,
            },
          ]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLDER ITEM
// ─────────────────────────────────────────────────────────────────────────────
function FolderItem({
  folder,
  activeNoteId,
  filteredNotes,
  onSelectNote,
  onToggle,
  onRenameFolder,
  onDeleteFolder,
  onAddNote,
  onRenameNote,
  onDeleteNote,
}) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // If search/tag filtering is active, only show matching notes
  const notesToDisplay = filteredNotes !== null
    ? folder.notes.filter((n) => filteredNotes.has(n.id))
    : folder.notes;

  // Don't render folder if filter is active and folder has zero matches
  if (filteredNotes !== null && notesToDisplay.length === 0) {
    return null;
  }

  return (
    <div className="mb-1">
      {/* Folder Header */}
      <div
        className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#1e222d]"
        onClick={() => {
          if (!renaming) onToggle();
        }}
      >
        {folder.expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        )}
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />

        {renaming ? (
          <InlineEdit
            value={folder.name}
            onCommit={(v) => {
              onRenameFolder(v);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="flex-1 truncate text-xs font-bold text-zinc-300">
            {folder.name}
          </span>
        )}

        <span className="text-[10px] text-zinc-500 font-mono">
          {notesToDisplay.length}
        </span>

        {!renaming && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddNote();
              }}
              title="Add Setup"
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-amber-400"
            >
              <FilePlus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className={`rounded p-1 transition-colors ${
                menuOpen
                  ? "text-zinc-200"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        )}

        {menuOpen && (
          <ContextMenu
            onClose={() => setMenuOpen(false)}
            items={[
              {
                label: "Rename Folder",
                icon: <Pencil className="h-3 w-3" />,
                action: () => setRenaming(true),
              },
              {
                label: "Delete Folder",
                icon: <Trash2 className="h-3 w-3" />,
                danger: true,
                action: onDeleteFolder,
              },
            ]}
          />
        )}
      </div>

      {/* Notes List */}
      {folder.expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#2a2e39]/60 pl-2">
          {notesToDisplay.length === 0 ? (
            <p className="py-1.5 pl-2 text-[10px] italic text-zinc-500">
              No matching setups
            </p>
          ) : (
            notesToDisplay.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                onSelect={() => onSelectNote(note.id)}
                onRename={(v) => onRenameNote(note.id, v)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function Sidebar({
  folders = [],
  activeNoteId,
  onSelectNote,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolder,
  onAddNote,
  onRenameNote,
  onDeleteNote,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");

  // Collect all unique tags across all notes
  const allTags = useMemo(() => {
    const set = new Set();
    folders.forEach((f) => {
      f.notes.forEach((n) => {
        if (Array.isArray(n.tags)) {
          n.tags.forEach((t) => set.add(t));
        }
      });
    });
    return Array.from(set);
  }, [folders]);

  // Compute matched note IDs based on search query and selected tag
  const matchingNoteIds = useMemo(() => {
    const hasQuery = searchQuery.trim().length > 0;
    const hasTag = selectedTag !== "ALL";

    if (!hasQuery && !hasTag) return null; // No filtering

    const matched = new Set();
    const q = searchQuery.toLowerCase().trim();

    folders.forEach((f) => {
      f.notes.forEach((n) => {
        const matchesQuery =
          !hasQuery ||
          n.title.toLowerCase().includes(q) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)));

        const matchesTag =
          !hasTag || (Array.isArray(n.tags) && n.tags.includes(selectedTag));

        if (matchesQuery && matchesTag) {
          matched.add(n.id);
        }
      });
    });

    return matched;
  }, [folders, searchQuery, selectedTag]);

  const totalNotes = folders.reduce((acc, f) => acc + f.notes.length, 0);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-[#2a2e39] bg-[#141822] select-none">
      {/* ── Explorer Title & New Folder Action ── */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-3.5 py-2.5 bg-[#181c27]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
            Trade Explorer
          </span>
        </div>
        <button
          type="button"
          onClick={onAddFolder}
          title="New Strategy Folder"
          className="cursor-pointer rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-amber-400"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>

      {/* ── FAST SEARCH BAR ── */}
      <div className="border-b border-[#2a2e39] p-2.5 bg-[#12151f]">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search setups, notes, #tags…"
            className="w-full rounded-lg border border-[#2a2e39] bg-[#1a1e2b] pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-zinc-500 hover:text-white text-xs"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* ── TAG FILTER CHIPS ── */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedTag("ALL")}
            className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-mono font-bold transition-all shrink-0 ${
              selectedTag === "ALL"
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "bg-[#1e222d] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({totalNotes})
          </button>

          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? "ALL" : tag)}
              className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-mono transition-all shrink-0 border ${
                selectedTag === tag
                  ? "ring-1 ring-amber-400 bg-amber-500/25 text-amber-300 border-amber-400/50 font-bold"
                  : `${getTagStyle(tag)} hover:brightness-125`
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── FOLDERS & NOTES TREE ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-zinc-700" />
            <p className="text-xs text-zinc-400">No strategy folders yet</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              Click + above to create your first folder
            </p>
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              activeNoteId={activeNoteId}
              filteredNotes={matchingNoteIds}
              onSelectNote={onSelectNote}
              onToggle={() => onToggleFolder(folder.id)}
              onRenameFolder={(v) => onRenameFolder(folder.id, v)}
              onDeleteFolder={() => onDeleteFolder(folder.id)}
              onAddNote={() => onAddNote(folder.id)}
              onRenameNote={(nid, v) => onRenameNote(folder.id, nid, v)}
              onDeleteNote={(nid) => onDeleteNote(folder.id, nid)}
            />
          ))
        )}
      </div>

      {/* ── SIDEBAR FOOTER ── */}
      <div className="border-t border-[#2a2e39] bg-[#10131a] px-3.5 py-2 flex items-center justify-between text-[9.5px] text-zinc-500">
        <span>
          {matchingNoteIds !== null
            ? `${matchingNoteIds.size} filtered`
            : `${totalNotes} setups`}
        </span>
        <span className="font-mono text-amber-400/80">XAU/USD Notebook</span>
      </div>
    </aside>
  );
}
