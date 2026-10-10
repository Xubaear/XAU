// ─────────────────────────────────────────────────────────────────────────────
// XAU/USD TRADING DASHBOARD — CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const LS_DATA_KEY   = "xau_notebook_v3";
export const CANVAS_PREFIX = "xau_canvas_";
export const CANVAS_W      = 1600;
export const CANVAS_H      = 900;

export const STROKE_COLORS = [
  { id: "bullish",   hex: "#22c55e", label: "Bullish Green" },
  { id: "bearish",   hex: "#ef4444", label: "Bearish Red"   },
  { id: "sr",        hex: "#38bdf8", label: "S/R Line (Sky)"},
  { id: "keylevel",  hex: "#f59e0b", label: "Key Level (Gold)"},
  { id: "liquidity", hex: "#a855f7", label: "Liquidity (Purple)"},
  { id: "neutral",   hex: "#f8fafc", label: "Neutral White" },
];

export const STROKE_SIZES = [
  { id: "fine",   size: 1.5, label: "Fine"   },
  { id: "medium", size: 3.5, label: "Medium" },
  { id: "bold",   size: 7,   label: "Bold"   },
  { id: "heavy",  size: 12,  label: "Heavy"  },
];

export const CANVAS_TOOLS = {
  PEN:    "pen",
  LINE:   "line",
  RECT:   "rect",
  CIRCLE: "circle",
  ERASER: "eraser",
};

export const PRESET_TAGS = [
  { name: "#XAUUSD",    color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { name: "#Breakout",  color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { name: "#Reversal",  color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { name: "#Win",       color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { name: "#Loss",      color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  { name: "#Missed",    color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
  { name: "#London",    color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { name: "#NY",        color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  { name: "#Asian",     color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  { name: "#OrderBlock",color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  { name: "#FVG",       color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
];

export const DEFAULT_CHECKLIST = [
  { id: "cl-1", text: "Higher Timeframe Trend Alignment", checked: false },
  { id: "cl-2", text: "Key Support / Resistance / Key Level identified", checked: false },
  { id: "cl-3", text: "Liquidity Sweep / Session High-Low Grab", checked: false },
  { id: "cl-4", text: "Entry Trigger (Candle pattern, Fair Value Gap, Break of Structure)", checked: false },
  { id: "cl-5", text: "Minimum Risk:Reward Ratio ≥ 1:2", checked: false },
  { id: "cl-6", text: "News / High-Impact Event Checked", checked: false },
];

export const DEFAULT_CALCULATOR = {
  balance: 10000,
  riskPercent: 1.0,
  riskDollar: 100,
  riskMode: "percent", // "percent" | "dollar"
  slPips: 200,         // 200 pips = $2.00 in XAU/USD (1 pip = $0.01)
  contractSize: 100,   // Standard gold: 100 oz
  goldPrice: 2350,     // Current Gold price for margin calculation
  leverage: 500,       // 1:100, 1:500, 1:2000
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const nowTs = () => new Date().toISOString();

export const fmtTs = (iso) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return (
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    "  ·  " +
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  );
};

export const makeNote = (title = "Untitled Setup", initialTags = ["#XAUUSD"]) => ({
  id:        uid(),
  title,
  content:   "",
  canvas:    "",
  tags:      initialTags,
  checklist: DEFAULT_CHECKLIST.map((item) => ({ ...item, id: uid() })),
  createdAt: nowTs(),
  updatedAt: nowTs(),
});

export const makeFolder = (name = "New Strategy") => {
  const note = makeNote("First Trade Setup", ["#XAUUSD", "#Breakout"]);
  return {
    id:       uid(),
    name,
    expanded: true,
    notes:    [note],
  };
};

export const DEFAULT_SETUP_CONTENT = `═══════════════════════════════════════════
  XAU/USD LONDON BREAKOUT — SETUP NOTES
═══════════════════════════════════════════

📌 BIAS & STRUCTURE
────────────────────
• H4 / Daily trend: Bullish continuation above $2,330.00
• Key Resistance: $2,348.50  |  Key Support: $2,318.00
• Liquidity Pool: Asian Session High swept at 08:15 UTC

📌 ENTRY SPECIFICATION
───────────────────────
• Entry Level: $2,335.20 (Retest of M15 Fair Value Gap)
• Confirmation: M5 Bullish Engulfing Candle
• Stop Loss: $2,333.20 (200 pips / $2.00 distance)
• Target 1: $2,341.20 (R:R 1:3.0)
• Target 2: $2,348.00 (R:R 1:6.4)

📌 EXECUTION RULES
──────────────────
• Risk: 1.0% ($100 on $10k account)
• Contract: 100 oz Standard Gold
• Calculated Lot Size: 0.50 Lots
• Move SL to Breakeven once TP1 is triggered!
`;

export const buildDefaultData = () => {
  const note1 = {
    ...makeNote("London Breakout Setup", ["#XAUUSD", "#Breakout", "#London", "#Win"]),
    content: DEFAULT_SETUP_CONTENT,
  };
  const note2 = makeNote("Risk Management & Rules", ["#XAUUSD"]);
  const note3 = makeNote("Asian Session Liquidity Sweep", ["#XAUUSD", "#Reversal", "#Asian"]);

  const folder1 = { id: uid(), name: "XAU Setups",       expanded: true,  notes: [note1, note2] };
  const folder2 = { id: uid(), name: "Session Strategies", expanded: true,  notes: [note3] };

  return {
    folders: [folder1, folder2],
    activeNoteId: note1.id,
    calculatorSettings: DEFAULT_CALCULATOR,
  };
};

export const loadData = () => {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.folders && Array.isArray(parsed.folders)) {
        parsed.folders = parsed.folders.map((f) => ({
          ...f,
          notes: (f.notes || []).map((n) => ({
            ...n,
            tags: Array.isArray(n.tags) ? n.tags : ["#XAUUSD"],
            checklist: Array.isArray(n.checklist) && n.checklist.length > 0
              ? n.checklist
              : DEFAULT_CHECKLIST.map((item) => ({ ...item, id: uid() })),
            canvas: n.canvas || loadCanvas(n.id) || "",
          })),
        }));
        if (!parsed.calculatorSettings) {
          parsed.calculatorSettings = DEFAULT_CALCULATOR;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load local notebook data, initializing default:", e);
  }
  return buildDefaultData();
};

export const persistData = (data) => {
  try {
    localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage save error (possibly quota):", e);
  }
};

export const loadCanvas = (noteId) =>
  noteId ? (localStorage.getItem(CANVAS_PREFIX + noteId) ?? null) : null;

export const saveCanvasToLS = (noteId, dataUrl) => {
  if (!noteId) return;
  try {
    if (dataUrl === null) localStorage.removeItem(CANVAS_PREFIX + noteId);
    else localStorage.setItem(CANVAS_PREFIX + noteId, dataUrl);
  } catch { /* quota */ }
};

export const deleteCanvasFromLS = (noteId) => {
  if (noteId) localStorage.removeItem(CANVAS_PREFIX + noteId);
};

export const getTagStyle = (tag) => {
  const normalized = tag.startsWith("#") ? tag : `#${tag}`;
  const found = PRESET_TAGS.find(
    (t) => t.name.toLowerCase() === normalized.toLowerCase()
  );
  if (found) return found.color;

  const palettes = [
    "bg-sky-500/15 text-sky-300 border-sky-500/30",
    "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    "bg-rose-500/15 text-rose-300 border-rose-500/30",
    "bg-purple-500/15 text-purple-300 border-purple-500/30",
  ];
  let sum = 0;
  for (let i = 0; i < normalized.length; i++) sum += normalized.charCodeAt(i);
  return palettes[sum % palettes.length];
};
