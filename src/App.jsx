import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import NoteEditor from "./components/NoteEditor";
import CanvasPanel from "./components/CanvasPanel";
import RiskCalculator from "./components/RiskCalculator";
import TradingChecklist from "./components/TradingChecklist";
import QuoteModal from "./components/QuoteModal";
import {
  deleteCanvasFromLS,
  loadData,
  nowTs,
  persistData,
  DEFAULT_CHECKLIST,
  DEFAULT_CALCULATOR,
  makeFolder,
  makeNote,
  uid,
} from "./utils/constants";
import { Trash2, Sparkles } from "lucide-react";

// Session storage key for entry quote modal
const SS_QUOTE_KEY = "xau_quote_seen";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmModal({ title = "Confirm Delete", message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a2e39] bg-[#1a1e2b] p-6 shadow-2xl shadow-black/80">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <Trash2 className="h-4.5 w-4.5 text-rose-400" />
          </div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        <p className="mb-6 text-xs leading-relaxed text-zinc-400">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APPLICATION ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadData());
  const [confirm, setConfirm] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Cloud Sync Status
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced" | "saving" | "offline"
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const isCloudLoadedRef = useRef(false);
  const cloudTimerRef = useRef(null);

  // Motivational quote on entry
  const [showQuote, setShowQuote] = useState(
    () => !sessionStorage.getItem(SS_QUOTE_KEY)
  );

  const handleQuoteClose = () => {
    sessionStorage.setItem(SS_QUOTE_KEY, "1");
    setShowQuote(false);
  };

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const { folders, activeNoteId, calculatorSettings = DEFAULT_CALCULATOR } = data;

  // ── 1. Real-time Firestore Hydration & Initial Load ─────────────────────────
  useEffect(() => {
    const docRef = doc(db, "trading_data", "user_data");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        // Skip in-flight writes triggered locally
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
                folders: cloudData.folders.map((f) => ({
                  ...f,
                  notes: (f.notes || []).map((n) => ({
                    ...n,
                    tags: Array.isArray(n.tags) ? n.tags : ["#XAUUSD"],
                    checklist: Array.isArray(n.checklist) && n.checklist.length > 0
                      ? n.checklist
                      : DEFAULT_CHECKLIST.map((item) => ({ ...item, id: uid() })),
                  })),
                })),
                activeNoteId: cloudData.activeNoteId || prev.activeNoteId,
                calculatorSettings: cloudData.calculatorSettings || prev.calculatorSettings || DEFAULT_CALCULATOR,
              };
            });
            setSyncStatus("synced");
          }
        } else {
          // Document does not exist yet: seed with current local data
          setDoc(
            docRef,
            {
              folders: data.folders,
              activeNoteId: data.activeNoteId,
              calculatorSettings: data.calculatorSettings || DEFAULT_CALCULATOR,
              lastUpdated: nowTs(),
            },
            { merge: true }
          )
            .then(() => setSyncStatus("synced"))
            .catch((err) => {
              console.warn("Firestore initialization error:", err);
              setSyncStatus("offline");
            });
          isCloudLoadedRef.current = true;
          setIsCloudLoaded(true);
        }
      },
      (error) => {
        console.warn("Firestore subscription error:", error);
        setSyncStatus("offline");
        isCloudLoadedRef.current = true;
        setIsCloudLoaded(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── 2. Debounced Auto-Save to Firestore + Synchronous localStorage Backup ──
  useEffect(() => {
    persistData(data);

    if (!isCloudLoaded) return;

    setSyncStatus("saving");
    clearTimeout(cloudTimerRef.current);

    cloudTimerRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, "trading_data", "user_data");
        await setDoc(
          docRef,
          {
            folders: data.folders,
            activeNoteId: data.activeNoteId,
            calculatorSettings: data.calculatorSettings || DEFAULT_CALCULATOR,
            lastUpdated: nowTs(),
          },
          { merge: true }
        );
        setSyncStatus("synced");
      } catch (err) {
        console.warn("Firestore auto-save error:", err);
        setSyncStatus("offline");
      }
    }, 1200);

    return () => clearTimeout(cloudTimerRef.current);
  }, [data, isCloudLoaded]);

  // ── 3. Connection Status Listener ──────────────────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      if (!isCloudLoaded) return;
      setSyncStatus("saving");
      try {
        const docRef = doc(db, "trading_data", "user_data");
        await setDoc(
          docRef,
          {
            folders: data.folders,
            activeNoteId: data.activeNoteId,
            calculatorSettings: data.calculatorSettings || DEFAULT_CALCULATOR,
            lastUpdated: nowTs(),
          },
          { merge: true }
        );
        setSyncStatus("synced");
        showToast("Connected! Cloud sync restored.");
      } catch {
        setSyncStatus("offline");
      }
    };

    const handleOffline = () => {
      setSyncStatus("offline");
      showToast("Offline mode. All changes backed up locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [data, isCloudLoaded, showToast]);

  // ── Derived Active Note ────────────────────────────────────────────────────
  const activeNote = useMemo(() => {
    for (const f of folders) {
      const n = f.notes.find((n) => n.id === activeNoteId);
      if (n) return n;
    }
    return null;
  }, [folders, activeNoteId]);

  const update = (fn) => setData((prev) => fn(prev));

  // ── Folder Operations ──────────────────────────────────────────────────────
  const addFolder = () => {
    const folder = makeFolder("New Strategy Folder");
    const firstNote = folder.notes[0];
    update((d) => ({
      ...d,
      folders: [...d.folders, folder],
      activeNoteId: firstNote.id,
    }));
    showToast(`Created folder "${folder.name}"`);
  };

  const renameFolder = (fid, name) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => (f.id === fid ? { ...f, name } : f)),
    }));

  const deleteFolder = (fid) => {
    const folder = folders.find((f) => f.id === fid);
    setConfirm({
      title: "Delete Folder",
      message: `Delete folder "${folder?.name || ""}" and all its trade setups and drawings? This cannot be undone.`,
      onConfirm: () => {
        folder?.notes.forEach((n) => deleteCanvasFromLS(n.id));
        update((d) => {
          const nextFolders = d.folders.filter((f) => f.id !== fid);
          const firstNote = nextFolders.flatMap((f) => f.notes)[0];
          return { ...d, folders: nextFolders, activeNoteId: firstNote?.id ?? null };
        });
        setConfirm(null);
        showToast("Folder deleted.");
      },
    });
  };

  const toggleFolder = (fid) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === fid ? { ...f, expanded: !f.expanded } : f
      ),
    }));

  // ── Note Operations ────────────────────────────────────────────────────────
  const addNote = (fid) => {
    const note = makeNote("New Trade Setup", ["#XAUUSD"]);
    update((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === fid
          ? { ...f, expanded: true, notes: [...f.notes, note] }
          : f
      ),
      activeNoteId: note.id,
    }));
    showToast("New trade setup created!");
  };

  const renameNote = (fid, nid, title) =>
    update((d) => ({
      ...d,
      folders: d.folders.map((f) =>
        f.id === fid
          ? {
              ...f,
              notes: f.notes.map((n) =>
                n.id === nid ? { ...n, title, updatedAt: nowTs() } : n
              ),
            }
          : f
      ),
    }));

  const deleteNote = (fid, nid) => {
    setConfirm({
      title: "Delete Setup",
      message: "Delete this trade setup and its canvas sketches permanently? This cannot be undone.",
      onConfirm: () => {
        deleteCanvasFromLS(nid);
        update((d) => {
          const nextFolders = d.folders.map((f) =>
            f.id === fid ? { ...f, notes: f.notes.filter((n) => n.id !== nid) } : f
          );
          const allNotes = nextFolders.flatMap((f) => f.notes);
          return {
            ...d,
            folders: nextFolders,
            activeNoteId: d.activeNoteId === nid ? (allNotes[0]?.id ?? null) : d.activeNoteId,
          };
        });
        setConfirm(null);
        showToast("Trade setup deleted.");
      },
    });
  };

  const selectNote = (id) => update((d) => ({ ...d, activeNoteId: id }));

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

  const updateNoteCanvas = useCallback((canvasDataUrl) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) =>
          n.id === activeNoteId
            ? { ...n, canvas: canvasDataUrl || "", updatedAt: nowTs() }
            : n
        ),
      })),
    }));
  }, [activeNoteId]);

  const addNoteTag = (tag) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) => {
          if (n.id !== activeNoteId) return n;
          const tags = Array.isArray(n.tags) ? n.tags : [];
          if (tags.includes(tag)) return n;
          return { ...n, tags: [...tags, tag], updatedAt: nowTs() };
        }),
      })),
    }));
    showToast(`Added tag ${tag}`);
  };

  const removeNoteTag = (tag) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) => {
          if (n.id !== activeNoteId) return n;
          const tags = Array.isArray(n.tags) ? n.tags : [];
          return {
            ...n,
            tags: tags.filter((t) => t !== tag),
            updatedAt: nowTs(),
          };
        }),
      })),
    }));
  };

  const updateNoteChecklist = (newChecklist) => {
    if (!activeNoteId) return;
    update((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        notes: f.notes.map((n) =>
          n.id === activeNoteId
            ? { ...n, checklist: newChecklist, updatedAt: nowTs() }
            : n
        ),
      })),
    }));
  };

  const updateCalculatorSettings = (newSettings) => {
    update((d) => ({
      ...d,
      calculatorSettings: newSettings,
    }));
  };

  // ── Append Text/Summary to Active Note ──────────────────────────────────────
  const appendTextToNote = (text) => {
    if (!activeNote) {
      showToast("Please open a note first.");
      return;
    }
    const currentContent = activeNote.content || "";
    // If rich HTML or plain text, append formatted block
    const formattedBlock = `<pre class="my-3 p-3 rounded-lg bg-zinc-900 border border-zinc-700/80 font-mono text-xs text-amber-300 whitespace-pre-wrap">${text}</pre><br/>`;
    const nextContent = currentContent + "\n" + formattedBlock;
    updateNoteContent(nextContent);
    showToast("Summary inserted into setup note!");
  };

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#0e1117] text-white antialiased"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Top Header Bar ── */}
      <Header
        sidebarOpen={sidebarOpen}
        canvasOpen={canvasOpen}
        checklistOpen={checklistOpen}
        calculatorOpen={calculatorOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleCanvas={() => setCanvasOpen((v) => !v)}
        onToggleChecklist={() => setChecklistOpen((v) => !v)}
        onToggleCalculator={() => setCalculatorOpen((v) => !v)}
        syncStatus={syncStatus}
      />

      {/* ── Main Workspace ── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left: Sidebar (Explorer, Search, Tag Filters, Folder Tree) */}
        {sidebarOpen && (
          <div className="w-[260px] shrink-0 h-full z-10 transition-all duration-200">
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

        {/* Center: Note Editor */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-[#2a2e39] min-w-0">
          <NoteEditor
            note={activeNote}
            onUpdateTitle={updateNoteTitle}
            onUpdateContent={updateNoteContent}
            onAddTag={addNoteTag}
            onRemoveTag={removeNoteTag}
          />
        </div>

        {/* Right: Drawing Canvas Panel (GoodNotes / TradingView Geometric tools) */}
        {canvasOpen && (
          <div className="hidden lg:flex lg:flex-col lg:w-[48%] xl:w-[45%] shrink-0 h-full min-w-0">
            <CanvasPanel
              noteId={activeNoteId}
              canvasData={activeNote?.canvas}
              onSaveCanvas={updateNoteCanvas}
              onToast={showToast}
            />
          </div>
        )}

        {/* ── Utility Drawer: Trading Checklist ── */}
        {checklistOpen && (
          <div className="absolute top-2 right-2 bottom-2 z-40 w-88 sm:w-96 shadow-2xl transition-transform animate-in slide-in-from-right duration-200">
            <TradingChecklist
              checklist={activeNote?.checklist || DEFAULT_CHECKLIST}
              onChangeChecklist={updateNoteChecklist}
              onInsertToNote={appendTextToNote}
              onClose={() => setChecklistOpen(false)}
              isFloating={true}
            />
          </div>
        )}

        {/* ── Utility Drawer: Risk & Lot Calculator ── */}
        {calculatorOpen && (
          <div className="absolute top-2 right-2 bottom-2 z-40 w-88 sm:w-96 shadow-2xl transition-transform animate-in slide-in-from-right duration-200">
            <RiskCalculator
              settings={calculatorSettings}
              onChangeSettings={updateCalculatorSettings}
              onInsertToNote={appendTextToNote}
              onClose={() => setCalculatorOpen(false)}
              isFloating={true}
            />
          </div>
        )}
      </div>

      {/* ── Global Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#1a1e2b]/95 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Entry Motivation Quote Splash Modal ── */}
      {showQuote && <QuoteModal onClose={handleQuoteClose} />}
    </div>
  );
}
