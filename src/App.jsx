import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RichNoteEditor from "./RichNoteEditor";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import {
  BookOpen,
  Brush,
  ChevronDown,
  ChevronRight,
  Circle,
  Eraser,
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const LS_DATA_KEY   = "xau_notebook_v3";       // folder/note structure
const CANVAS_PREFIX = "xau_canvas_";           // per-note canvas: xau_canvas_{id}
const CANVAS_W      = 1600;
const CANVAS_H      = 900;

const STROKE_COLORS = [
  { id: "bullish",  hex: "#22c55e", label: "Bullish"   },
  { id: "bearish",  hex: "#ef4444", label: "Bearish"   },
  { id: "sr",       hex: "#38bdf8", label: "S/R Line"  },
  { id: "keylevel", hex: "#f59e0b", label: "Key Level" },
  { id: "neutral",  hex: "#f8fafc", label: "Neutral"   },
];

const STROKE_SIZES = [
  { id: "fine",   size: 1.5, label: "Fine"   },
  { id: "medium", size: 3.5, label: "Medium" },
  { id: "bold",   size: 8,   label: "Bold"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const uid   = () => Math.random().toString(36).slice(2, 10);
const nowTs = () => new Date().toISOString();

const fmtTs = (iso) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return (
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    "  ·  " +
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  );
};

const makeNote = (title = "Untitled Note") => ({
  id:        uid(),
  title,
  content:   "",
  canvas:    "",
  createdAt: nowTs(),
  updatedAt: nowTs(),
});

const makeFolder = (name = "New Folder") => {
  const note = makeNote("My First Note");
  return {
    id:       uid(),
    name,
    expanded: true,
    notes:    [note],
  };
};

const DEFAULT_CONTENT = `═══════════════════════════════════════════
  XAU/USD LONDON BREAKOUT — SETUP NOTES
═══════════════════════════════════════════

📌 BIAS
────────
• H4/Daily trend: Bullish above 2,330
• Key Resistance: 2,348  |  Key Support: 2,318

📌 ENTRY PLAN
──────────────
• Wait for M15 BOS above 2,335
• Enter on retest with M5 confirmation candle
• SL: Below last swing low (~2,328)
• TP1: 2,342  |  TP2: 2,350
• R:R ratio: 1:2.5

📌 RISK
────────
• Max risk this trade: 1% of account
• No entry if spread > 35 pts
• Cancel if price reaches SL before entry

📌 NOTES
─────────
`;

const buildDefaultData = () => {
  const note1  = { ...makeNote("London Breakout"), content: DEFAULT_CONTENT };
  const note2  = makeNote("Risk Management Rules");
  const note3  = makeNote("Asian Session Range");
  const folder1 = { id: uid(), name: "XAU Setups",       expanded: true,  notes: [note1, note2] };
  const folder2 = { id: uid(), name: "Session Strategy",  expanded: false, notes: [note3] };
  return {
    folders:      [folder1, folder2],
    activeNoteId: note1.id,
  };
};

const loadData = () => {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.folders) {
        parsed.folders = parsed.folders.map((f) => ({
          ...f,
          notes: (f.notes || []).map((n) => ({
            ...n,
            canvas: n.canvas || loadCanvas(n.id) || "",
          })),
        }));
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return buildDefaultData();
};

const persistData = (data) => {
  try {
    localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
  } catch { /* quota */ }
};

const loadCanvas = (noteId) =>
  noteId ? (localStorage.getItem(CANVAS_PREFIX + noteId) ?? null) : null;

const saveCanvasToLS = (noteId, dataUrl) => {
  if (!noteId) return;
  try {
    if (dataUrl === null) localStorage.removeItem(CANVAS_PREFIX + noteId);
    else                  localStorage.setItem(CANVAS_PREFIX + noteId, dataUrl);
  } catch { /* quota */ }
};

const deleteCanvasFromLS = (noteId) => {
  if (noteId) localStorage.removeItem(CANVAS_PREFIX + noteId);
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({ title = "Confirm Delete", message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900 p-6 shadow-2xl shadow-black/60">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <Trash2 className="h-4 w-4 text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

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
    else         onCancel();
  };

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter")  commit();
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 rounded-md bg-zinc-700/80 px-2 py-0.5 text-xs text-white outline-none ring-1 ring-amber-500/50 focus:ring-amber-400"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT MENU (floating)
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
      className="absolute right-0 top-full z-40 mt-1 min-w-[130px] rounded-xl border border-zinc-700/80 bg-zinc-900 py-1 shadow-2xl shadow-black/50"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-zinc-800 ${
            item.danger ? "text-red-400 hover:text-red-300" : "text-zinc-300 hover:text-white"
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
      className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
        isActive
          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20"
          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
      }`}
      onClick={() => { if (!renaming) onSelect(); }}
    >
      <FileText className="h-3 w-3 shrink-0 opacity-60" />

      {renaming ? (
        <InlineEdit
          value={note.title}
          onCommit={(v) => { onRename(v); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className="flex-1 truncate font-medium">{note.title || "Untitled"}</span>
      )}

      {!renaming && (
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className={`shrink-0 rounded p-0.5 transition-opacity ${
            menuOpen ? "opacity-100 text-zinc-200" : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}

      {menuOpen && (
        <ContextMenu
          onClose={() => setMenuOpen(false)}
          items={[
            {
              label: "Rename",
              icon:  <Pencil className="h-3 w-3" />,
              action: () => setRenaming(true),
            },
            {
              label:  "Delete Note",
              icon:   <Trash2 className="h-3 w-3" />,
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
  onSelectNote,
  onToggle,
  onRenameFolder,
  onDeleteFolder,
  onAddNote,
  onRenameNote,
  onDeleteNote,
}) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  return (
    <div className="mb-0.5">
      {/* ── Folder header ── */}
      <div
        className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/60"
        onClick={() => { if (!renaming) onToggle(); }}
      >
        {folder.expanded
          ? <ChevronDown  className="h-3 w-3 shrink-0 text-zinc-500" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
        }
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />

        {renaming ? (
          <InlineEdit
            value={folder.name}
            onCommit={(v) => { onRenameFolder(v); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="flex-1 truncate text-xs font-bold text-zinc-300">{folder.name}</span>
        )}

        {!renaming && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(); }}
              title="Add note"
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-amber-400"
            >
              <FilePlus className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className={`rounded p-1 transition-colors ${menuOpen ? "text-zinc-200" : "text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"}`}
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
                label:  "Rename Folder",
                icon:   <Pencil className="h-3 w-3" />,
                action: () => setRenaming(true),
              },
              {
                label:  "Delete Folder",
                icon:   <Trash2 className="h-3 w-3" />,
                danger: true,
                action: onDeleteFolder,
              },
            ]}
          />
        )}
      </div>

      {/* ── Notes list ── */}
      {folder.expanded && (
        <div className="ml-5 mt-0.5 space-y-px">
          {folder.notes.length === 0 && (
            <p className="py-1.5 pl-2 text-[10px] italic text-zinc-700">
              No notes — click + to create one
            </p>
          )}
          {folder.notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={activeNoteId === note.id}
              onSelect={() => onSelectNote(note.id)}
              onRename={(v) => onRenameNote(note.id, v)}
              onDelete={() => onDeleteNote(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({
  folders,
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
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
            Explorer
          </span>
        </div>
        <button
          onClick={onAddFolder}
          title="New folder"
          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-amber-400"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-zinc-800" />
            <p className="text-xs text-zinc-600">No folders yet</p>
            <p className="mt-1 text-[10px] text-zinc-700">Click the + icon above to start</p>
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              activeNoteId={activeNoteId}
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

      {/* Footer */}
      <div className="border-t border-zinc-800 px-3 py-2">
        <p className="text-[9px] text-zinc-700">
          {folders.reduce((acc, f) => acc + f.notes.length, 0)} notes &nbsp;·&nbsp; Auto-saved locally
        </p>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function NoteEditor({ note, onUpdateTitle, onUpdateContent }) {
  const saveTimer  = useRef(null);
  const [lastSaved, setLastSaved] = useState(note?.updatedAt ?? null);
  const [pulse,     setPulse]     = useState(false);

  // Reset timestamp indicator when note switches
  useEffect(() => {
    setLastSaved(note?.updatedAt ?? null);
  }, [note?.id]);

  const handleContent = (val) => {
    const nextVal = typeof val === "string" ? val : val?.target?.value ?? "";
    onUpdateContent(nextVal);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setLastSaved(nowTs());
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
    }, 500);
  };

  if (!note) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950">
        <FileText className="mb-3 h-14 w-14 text-zinc-800" />
        <p className="text-sm font-semibold text-zinc-600">No note open</p>
        <p className="mt-1 text-xs text-zinc-700">
          Select a note from the explorer or create a new one.
        </p>
      </div>
    );
  }

  const plainText = (note.content || "").replace(/<[^>]+>/g, " ");
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const chars = plainText.length;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Note title + meta */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <input
          type="text"
          value={note.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Note title…"
          className="w-full bg-transparent text-xl font-bold tracking-tight text-white placeholder-zinc-700 outline-none"
        />
        <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600">
          <span
            className={`flex items-center gap-1 transition-colors ${
              pulse ? "text-green-500" : "text-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
                pulse ? "bg-green-500" : "bg-zinc-700"
              }`}
            />
            Saved {fmtTs(lastSaved)}
          </span>
          <span className="text-zinc-800">·</span>
          <span>{words} words</span>
          <span className="text-zinc-800">·</span>
          <span>{chars} chars</span>
        </div>
      </div>

      {/* Rich text note editor */}
      <RichNoteEditor
        key={note.id}
        value={note.content}
        onChange={handleContent}
        placeholder="Write your trading plan, rules, entry/exit parameters, observations…"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CanvasPanel({ noteId, canvasData, onSaveCanvas, onRequestClear }) {
  const canvasRef  = useRef(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef(null);
  const saveTimer  = useRef(null);
  const prevNoteId = useRef(null);

  const [activeColor, setActiveColor] = useState(STROKE_COLORS[0]);
  const [activeSize,  setActiveSize]  = useState(STROKE_SIZES[1]);
  const [isEraser,    setIsEraser]    = useState(false);
  const [showClear,   setShowClear]   = useState(false);

  // ── Load canvas when note switches ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    prevNoteId.current = noteId;

    const saved = canvasData || loadCanvas(noteId);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        if (prevNoteId.current === noteId && canvasRef.current) {
          const c = canvasRef.current.getContext("2d");
          c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        }
      };
      img.src = saved;
    }
  }, [noteId]);

  // ── Sync canvas data if fetched from Firestore after mount ──────────────────
  useEffect(() => {
    if (!canvasData || isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      if (prevNoteId.current === noteId && canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      }
    };
    img.src = canvasData;
  }, [canvasData]);

  // ── Persist canvas to LS & active note state (debounced) ───────────────────
  const triggerSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || !noteId) return;
      try {
        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        saveCanvasToLS(noteId, dataUrl);
        onSaveCanvas?.(dataUrl);
      } catch { /* quota */ }
    }, 400);
  }, [noteId, onSaveCanvas]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const sx     = CANVAS_W / rect.width;
    const sy     = CANVAS_H / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * sx,
      y: (src.clientY - rect.top)  * sy,
    };
  };

  // ── Drawing events ─────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current   = getPos(e);
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const pos    = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth   = activeSize.size * 5;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = activeColor.hex;
      ctx.lineWidth   = activeSize.size;
    }
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    lastPos.current = pos;
  };

  const onMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current   = null;
    triggerSave();
  };

  // ── Clear ──────────────────────────────────────────────────────────────────
  const doClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    saveCanvasToLS(noteId, null);
    onSaveCanvas?.(null);
    setShowClear(false);
  };

  if (!noteId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950">
        <Brush className="mb-3 h-14 w-14 text-zinc-800" />
        <p className="text-sm font-semibold text-zinc-600">No note selected</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-950">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-zinc-800 px-3 py-2">
        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          {STROKE_COLORS.map((c) => (
            <button
              key={c.id}
              title={c.label}
              onClick={() => { setActiveColor(c); setIsEraser(false); }}
              className="rounded-full border-2 transition-transform hover:scale-125"
              style={{
                width: 16, height: 16,
                backgroundColor: c.hex,
                borderColor: (activeColor.id === c.id && !isEraser) ? "#fff" : "transparent",
                transform: (activeColor.id === c.id && !isEraser) ? "scale(1.25)" : undefined,
              }}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Stroke size */}
        <div className="flex items-center gap-1">
          {STROKE_SIZES.map((s) => (
            <button
              key={s.id}
              title={s.label}
              onClick={() => setActiveSize(s)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                activeSize.id === s.id
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              <span
                className="rounded-full bg-current"
                style={{ display: "block", width: s.size + 2, height: s.size + 2 }}
              />
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Eraser */}
        <button
          onClick={() => setIsEraser((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all ${
            isEraser
              ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          <Eraser className="h-3 w-3" />
          Eraser
        </button>

        <button
          onClick={() => setShowClear(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-900/20 hover:text-red-400"
        >
          <RotateCcw className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* ── Color legend ── */}
      <div className="flex flex-wrap gap-3 border-b border-zinc-800/40 px-3 py-1.5">
        {STROKE_COLORS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.hex }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* ── Canvas ── */}
      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Midline */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-amber-500/10" />

        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="h-full w-full cursor-crosshair touch-none"
          style={{ display: "block" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />

        {/* Ghost hint */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none opacity-[0.06]">
          <Brush className="mb-2 h-12 w-12 text-amber-400" />
          <p className="text-xs text-zinc-400">Sketch candles · S/R levels · Trend structures</p>
        </div>
      </div>

      {showClear && (
        <ConfirmModal
          title="Clear Canvas"
          message="Erase all drawings on this canvas? This action cannot be undone."
          onConfirm={doClear}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CLOCK — with session-active indicators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when `tz` local clock is inside [openH:openM … closeH:closeM].
 * All times are in the session's own timezone (no cross-timezone comparison).
 */
function isSessionOpen(time, tz, openH, openM, closeH, closeM) {
  const localStr = time.toLocaleString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = localStr.split(":").map(Number);
  const mins      = h * 60 + m;
  const openMins  = openH  * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  return mins >= openMins && mins < closeMins;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (tz) =>
    time.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  // London: 08:00–16:30 local  |  NY: 08:00–17:00 local
  const ldnOpen = isSessionOpen(time, "Europe/London",    8, 0, 16, 30);
  const nyOpen  = isSessionOpen(time, "America/New_York", 8, 0, 17,  0);

  const sessions = [
    {
      label: "UTC",
      tz:    "UTC",
      active: false,          // UTC is always shown, no session concept
      title:  "Coordinated Universal Time",
    },
    {
      label: "LDN",
      tz:    "Europe/London",
      active: ldnOpen,
      title:  ldnOpen ? "London session OPEN" : "London session closed",
    },
    {
      label: "NY",
      tz:    "America/New_York",
      active: nyOpen,
      title:  nyOpen ? "New York session OPEN" : "New York session closed",
    },
    {
      label: "TKY",
      tz:    "Asia/Tokyo",
      active: false,          // Tokyo awareness only
      title:  "Tokyo / Asia time",
    },
    {
      label: "BD",
      tz:    "Asia/Dhaka",
      active: false,
      title:  "Bangladesh (UTC+6)",
    },
  ];

  return (
    <div className="hidden items-center gap-4 xl:flex">
      {sessions.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5" title={s.title}>
          {/* Active indicator dot */}
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-700 ${
              s.active
                ? "bg-green-400 shadow-[0_0_6px_1px_rgba(74,222,128,0.7)] animate-pulse"
                : "bg-zinc-700"
            }`}
          />
          <span
            className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${
              s.active ? "text-green-400" : "text-zinc-600"
            }`}
          >
            {s.label}
          </span>
          <span
            className={`font-mono text-[11px] font-semibold tabular-nums transition-colors ${
              s.active ? "text-green-300" : "text-amber-400"
            }`}
          >
            {fmt(s.tz)}
          </span>
        </div>
      ))}

      {/* Session status badge — shown only when at least one session is live */}
      {(ldnOpen || nyOpen) && (
        <span className="ml-1 flex items-center gap-1 rounded-full bg-green-950/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400 ring-1 ring-green-800/60">
          <span className="h-1 w-1 animate-ping rounded-full bg-green-400" />
          {ldnOpen && nyOpen ? "LDN + NY" : ldnOpen ? "LDN" : "NY"} Open
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE MODAL — entry motivation splash
// ─────────────────────────────────────────────────────────────────────────────
const SS_QUOTE_KEY = "xau_quote_seen";

function QuoteModal({ onClose }) {
  const [countdown, setCountdown] = useState(4);   // auto-dismiss in 4 s
  const [visible,   setVisible]   = useState(false); // drives fade-in

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Countdown & auto-dismiss
  useEffect(() => {
    if (countdown <= 0) { handleClose(); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleClose = () => {
    setVisible(false);
    // Wait for the fade-out transition to finish before unmounting
    setTimeout(onClose, 350);
  };

  // Circumference for the SVG countdown ring
  const R   = 10;
  const C   = 2 * Math.PI * R;
  const pct = countdown / 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      <div
        style={{
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "transform 0.35s ease, opacity 0.35s ease",
          opacity: visible ? 1 : 0,
        }}
        className="relative w-full max-w-md rounded-2xl border border-amber-500/20 bg-zinc-900 p-8 shadow-2xl shadow-black/60"
      >
        {/* Gold accent bar */}
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/25">
            <TrendingUp className="h-7 w-7 text-amber-400" />
          </div>
        </div>

        {/* Quote */}
        <blockquote className="mb-2 text-center">
          <p className="text-lg font-bold leading-snug tracking-tight text-white">
            &ldquo;Trend is your best friend.
            <br />
            <span className="text-amber-400">Protect your capital first.</span>&rdquo;
          </p>
        </blockquote>
        <p className="mb-8 text-center text-xs text-zinc-600">XAU/USD · Gold Day Trading Dashboard</p>

        {/* CTA + countdown ring */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleClose}
            className="rounded-xl bg-amber-500 px-7 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-900/30 transition-all hover:bg-amber-400 hover:shadow-amber-800/40 active:scale-95"
          >
            Let's Trade
          </button>

          {/* SVG countdown ring */}
          <div className="relative flex items-center justify-center" title={`Auto-closing in ${countdown}s`}>
            <svg width="32" height="32" viewBox="0 0 24 24" className="-rotate-90">
              {/* Track */}
              <circle cx="12" cy="12" r={R} fill="none" stroke="#3f3f46" strokeWidth="2" />
              {/* Progress */}
              <circle
                cx="12" cy="12" r={R}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>
            <span className="absolute text-[10px] font-bold tabular-nums text-zinc-400">{countdown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
function Header({ sidebarOpen, canvasOpen, onToggleSidebar, onToggleCanvas, syncStatus = "synced" }) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-black tracking-tight text-white">
            XAU<span className="text-amber-400">/USD</span>
          </span>
          <span className="hidden text-xs font-medium text-zinc-600 sm:block">Trading Notebook</span>
        </div>
      </div>

      {/* Center — clocks */}
      <LiveClock />

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Cloud Sync Status Badge */}
        {syncStatus === "saving" ? (
          <div
            className="flex items-center gap-1.5 rounded-full bg-amber-950/60 px-2.5 py-0.5 ring-1 ring-amber-700/60 transition-colors"
            title="Saving changes to Firebase Firestore..."
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
              Saving...
            </span>
          </div>
        ) : syncStatus === "offline" ? (
          <div
            className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-0.5 ring-1 ring-zinc-700 transition-colors"
            title="Offline — changes saved to local storage backup"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Offline Backup
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 px-2.5 py-0.5 ring-1 ring-emerald-800/60 transition-colors"
            title="All folders, notes, and sketches synced to Firebase Cloud"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Cloud Synced
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 rounded-full bg-green-950/50 px-2 py-0.5 ring-1 ring-green-900/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-green-500">Live</span>
        </div>
        <button
          onClick={onToggleCanvas}
          title={canvasOpen ? "Collapse canvas" : "Expand canvas"}
          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {canvasOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [data,          setData]          = useState(() => loadData());
  const [confirm,       setConfirm]       = useState(null);   // { title, message, onConfirm }
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [canvasOpen,    setCanvasOpen]    = useState(true);
  const [syncStatus,    setSyncStatus]    = useState("synced"); // "synced" | "saving" | "offline"
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const isCloudLoadedRef                  = useRef(false);
  const cloudTimerRef                     = useRef(null);

  // Quote modal: show once per browser session (sessionStorage flag)
  const [showQuote, setShowQuote] = useState(
    () => !sessionStorage.getItem(SS_QUOTE_KEY)
  );

  const handleQuoteClose = () => {
    sessionStorage.setItem(SS_QUOTE_KEY, "1");
    setShowQuote(false);
  };

  const { folders, activeNoteId } = data;

  // ── 1. Real-time Firestore Hydration & Initial Load ─────────────────────────
  useEffect(() => {
    const docRef = doc(db, "trading_data", "user_data");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        // Skip local changes in-flight to prevent clobbering active edits
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          if (cloudData && Array.isArray(cloudData.folders) && cloudData.folders.length > 0) {
            setData((prev) => {
              isCloudLoadedRef.current = true;
              setIsCloudLoaded(true);
              return {
                folders: cloudData.folders,
                activeNoteId: cloudData.activeNoteId || prev.activeNoteId,
              };
            });
            setSyncStatus("synced");
          }
        } else {
          // Document does not exist yet: seed Firestore with current local data
          setDoc(docRef, {
            folders: data.folders,
            activeNoteId: data.activeNoteId,
            lastUpdated: nowTs(),
          }, { merge: true })
            .then(() => setSyncStatus("synced"))
            .catch((err) => {
              console.warn("Firestore initialization notice:", err);
              setSyncStatus("offline");
            });
          isCloudLoadedRef.current = true;
          setIsCloudLoaded(true);
        }
      },
      (error) => {
        console.warn("Firestore onSnapshot error:", error);
        setSyncStatus("offline");
        isCloudLoadedRef.current = true;
        setIsCloudLoaded(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── 2. Debounced Auto-Save to Firestore + Synchronous localStorage Backup ──
  useEffect(() => {
    // Immediate fallback to localStorage (keeps offline data safe)
    persistData(data);

    // Only auto-save to cloud after initial snapshot is ready
    if (!isCloudLoaded) return;

    setSyncStatus("saving");
    clearTimeout(cloudTimerRef.current);

    cloudTimerRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, "trading_data", "user_data");
        await setDoc(docRef, {
          folders: data.folders,
          activeNoteId: data.activeNoteId,
          lastUpdated: nowTs(),
        }, { merge: true });
        setSyncStatus("synced");
      } catch (err) {
        console.warn("Firestore auto-save error:", err);
        setSyncStatus("offline");
      }
    }, 1200);

    return () => clearTimeout(cloudTimerRef.current);
  }, [data, isCloudLoaded]);

  // ── 3. Connection Restoration Sync Listener ────────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      if (!isCloudLoaded) return;
      setSyncStatus("saving");
      try {
        const docRef = doc(db, "trading_data", "user_data");
        await setDoc(docRef, {
          folders: data.folders,
          activeNoteId: data.activeNoteId,
          lastUpdated: nowTs(),
        }, { merge: true });
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    };

    const handleOffline = () => setSyncStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [data, isCloudLoaded]);

  // ── Derived: active note ───────────────────────────────────────────────────
  const activeNote = useMemo(() => {
    for (const f of folders) {
      const n = f.notes.find((n) => n.id === activeNoteId);
      if (n) return n;
    }
    return null;
  }, [folders, activeNoteId]);

  // ── Generic updater ────────────────────────────────────────────────────────
  const update = (fn) => setData((prev) => fn(prev));

  // ── Folder operations ──────────────────────────────────────────────────────
  const addFolder = () => {
    const folder = makeFolder("New Folder");
    const firstNote = folder.notes[0];
    update((d) => ({
      ...d,
      folders:      [...d.folders, folder],
      activeNoteId: firstNote.id,
    }));
  };

  const renameFolder = (fid, name) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => (f.id === fid ? { ...f, name } : f)),
    }));

  const deleteFolder = (fid) => {
    setConfirm({
      title:   "Delete Folder",
      message: "Delete this folder and ALL its notes? Canvas data will also be erased. This cannot be undone.",
      onConfirm: () => {
        // Remove canvas data for every note in this folder
        const folder = data.folders.find((f) => f.id === fid);
        folder?.notes.forEach((n) => deleteCanvasFromLS(n.id));

        update((d) => {
          const folders = d.folders.filter((f) => f.id !== fid);
          const firstNote = folders.flatMap((f) => f.notes)[0];
          return { ...d, folders, activeNoteId: firstNote?.id ?? null };
        });
        setConfirm(null);
      },
    });
  };

  const toggleFolder = (fid) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => (f.id === fid ? { ...f, expanded: !f.expanded } : f)),
    }));

  // ── Note operations ────────────────────────────────────────────────────────
  const addNote = (fid) => {
    const note = makeNote("New Note");
    update((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === fid
          ? { ...f, expanded: true, notes: [...f.notes, note] }
          : f
      ),
      activeNoteId: note.id,
    }));
  };

  const renameNote = (fid, nid, title) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === fid
          ? { ...f, notes: f.notes.map((n) => (n.id === nid ? { ...n, title, updatedAt: nowTs() } : n)) }
          : f
      ),
    }));

  const deleteNote = (fid, nid) => {
    setConfirm({
      title:   "Delete Note",
      message: "Delete this note and its canvas sketch permanently? This cannot be undone.",
      onConfirm: () => {
        deleteCanvasFromLS(nid);
        update((d) => {
          const folders = d.folders.map((f) =>
            f.id === fid ? { ...f, notes: f.notes.filter((n) => n.id !== nid) } : f
          );
          const allNotes = folders.flatMap((f) => f.notes);
          return {
            ...d,
            folders,
            activeNoteId: d.activeNoteId === nid ? (allNotes[0]?.id ?? null) : d.activeNoteId,
          };
        });
        setConfirm(null);
      },
    });
  };

  const selectNote = (id) =>
    update((d) => ({ ...d, activeNoteId: id }));

  const updateNoteTitle = (title) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) =>
          n.id === activeNoteId ? { ...n, title, updatedAt: nowTs() } : n
        ),
      })),
    }));
  };

  const updateNoteContent = (content) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) =>
          n.id === activeNoteId ? { ...n, content, updatedAt: nowTs() } : n
        ),
      })),
    }));
  };

  // Canvas update handler
  const updateNoteCanvas = useCallback((canvasDataUrl) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) =>
          n.id === activeNoteId ? { ...n, canvas: canvasDataUrl || "", updatedAt: nowTs() } : n
        ),
      })),
    }));
  }, [activeNoteId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-white antialiased"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Header
        sidebarOpen={sidebarOpen}
        canvasOpen={canvasOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleCanvas={() => setCanvasOpen((v) => !v)}
        syncStatus={syncStatus}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div className="w-[250px] shrink-0">
            <Sidebar
              folders={folders}
              activeNoteId={activeNoteId}
              onSelectNote={selectNote}
              onAddFolder={addFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onToggleFolder={toggleFolder}
              onAddNote={addNote}
              onRenameNote={renameNote}
              onDeleteNote={deleteNote}
            />
          </div>
        )}

        {/* ── Note editor ── */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-zinc-800">
          <NoteEditor
            note={activeNote}
            onUpdateTitle={updateNoteTitle}
            onUpdateContent={updateNoteContent}
          />
        </div>

        {/* ── Canvas (hidden on small screens) ── */}
        {canvasOpen && (
          <div className="hidden w-[44%] shrink-0 lg:flex lg:flex-col">
            <CanvasPanel
              noteId={activeNoteId}
              canvasData={activeNote?.canvas}
              onSaveCanvas={updateNoteCanvas}
            />
          </div>
        )}
      </div>

      {/* Global confirm modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Entry quote modal (once per session) */}
      {showQuote && <QuoteModal onClose={handleQuoteClose} />}
    </div>
  );
}
