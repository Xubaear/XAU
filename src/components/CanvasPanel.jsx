import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Brush,
  Minus,
  Square,
  Circle,
  Type,
  Eraser,
  Undo2,
  Redo2,
  RotateCcw,
  Upload,
  Download,
  Sparkles,
  Layers,
  Tag,
  X,
  Trash2,
} from "lucide-react";
import {
  CANVAS_TOOLS,
  CANVAS_W,
  CANVAS_H,
  STROKE_COLORS,
  QUICK_ZONE_TAGS,
  TEXT_FONT_SIZES,
  loadCanvas,
  saveCanvasToLS,
  uid,
} from "../utils/constants";

// Convert hex color to rgba with custom alpha
function hexToRgba(hex, alpha = 0.15) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CanvasPanel({
  noteId,
  canvasData,
  onSaveCanvas,
  onToast,
}) {
  const containerRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const inlineInputRef = useRef(null);

  // Drawing state refs
  const isDrawing = useRef(false);
  const startPos = useRef(null);
  const lastPos = useRef(null);
  const strokePoints = useRef([]);
  const autoSnapTimer = useRef(null);
  const snappedShape = useRef(null);
  const isShiftPressed = useRef(false);
  const saveTimer = useRef(null);
  const prevNoteId = useRef(null);

  // Dragging text ref: { id, startX, startY, startClientX, startClientY, hasMoved }
  const dragRef = useRef(null);

  // Undo / Redo stacks: items are { image: dataUrl, texts: [...] }
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  // Responsive scale tracker (relative to 800px base width)
  const [canvasScale, setCanvasScale] = useState(1);

  // UI state
  const [activeTool, setActiveTool] = useState(CANVAS_TOOLS.PEN);
  const [activeColor, setActiveColor] = useState(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3.5);
  const [fillZones, setFillZones] = useState(true); // Fill rectangles (Order Blocks)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [snapNotification, setSnapNotification] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Text Tool State
  // textElements: Array of { id, type: 'text', content, x, y, color, fontSize, hasBg }
  const [textElements, setTextElements] = useState([]);
  const textElementsRef = useRef([]);

  useEffect(() => {
    textElementsRef.current = textElements;
  }, [textElements]);

  const [selectedTextId, setSelectedTextId] = useState(null);
  const [activeFontSize, setActiveFontSize] = useState(18); // 14, 18, 24
  const [textHasBg, setTextHasBg] = useState(true); // Background pill/badge toggle
  const [stagedQuickTag, setStagedQuickTag] = useState(null); // Click-to-place quick tag preset

  // Direct On-Canvas Inline Typing State: { id, x, y, content, isNew, color, fontSize, hasBg } | null
  const [editingText, setEditingText] = useState(null);
  const editingTextRef = useRef(null);

  useEffect(() => {
    editingTextRef.current = editingText;
  }, [editingText]);

  // Focus inline input automatically when mounted
  useEffect(() => {
    if (editingText && inlineInputRef.current) {
      const el = inlineInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
      el.style.height = "auto";
      el.style.height = `${Math.max(28, el.scrollHeight)}px`;
    }
  }, [editingText]);

  // ── Track Canvas Container Dimensions for Responsive Font Scaling ──────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        setCanvasScale(rect.width / 800);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Push current base canvas & text elements state to undo stack ───────────
  const pushUndoState = useCallback((customTexts) => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/webp", 0.9);
      const textsToSave =
        customTexts !== undefined ? customTexts : textElementsRef.current;
      undoStack.current.push({
        image: dataUrl,
        texts: JSON.parse(JSON.stringify(textsToSave || [])),
      });
      if (undoStack.current.length > 30) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch (e) {
      console.warn("Undo push failed:", e);
    }
  }, []);

  // ── Debounced save to LS & parent callback ──────────────────────────────────
  const triggerSave = useCallback(
    (customTexts) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const canvas = baseCanvasRef.current;
        if (!canvas || !noteId) return;
        try {
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          const currentTexts =
            customTexts !== undefined ? customTexts : textElementsRef.current;
          const payload = JSON.stringify({
            image: dataUrl,
            texts: currentTexts || [],
          });
          saveCanvasToLS(noteId, payload);
          onSaveCanvas?.(payload);
        } catch (e) {
          console.warn("Canvas save quota error:", e);
        }
      }, 350);
    },
    [noteId, onSaveCanvas]
  );

  // ── Coordinate Mapping: Mouse/Touch Event -> Canvas (1600x900) ──────────────
  const getPos = useCallback((e) => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  // ── Commit Direct Inline Text to Canvas Elements Array ─────────────────────
  const handleCommitEditingText = useCallback(() => {
    const current = editingTextRef.current;
    if (!current) return;
    const cleanContent = (current.content || "").trim();

    if (!cleanContent) {
      if (!current.isNew) {
        const nextTexts = textElementsRef.current.filter(
          (t) => t.id !== current.id
        );
        pushUndoState(nextTexts);
        setTextElements(nextTexts);
        textElementsRef.current = nextTexts;
        triggerSave(nextTexts);
      }
      setEditingText(null);
      editingTextRef.current = null;
      return;
    }

    let nextTexts;
    if (current.isNew) {
      const newItem = {
        id: current.id || uid(),
        type: "text",
        content: cleanContent,
        x: Math.round(current.x),
        y: Math.round(current.y),
        color: current.color || activeColor.hex,
        fontSize: current.fontSize || activeFontSize,
        hasBg: current.hasBg ?? textHasBg,
      };
      nextTexts = [...textElementsRef.current, newItem];
      setSelectedTextId(newItem.id);
      setSnapNotification(`🏷️ Added "${cleanContent}"!`);
      setTimeout(() => setSnapNotification(null), 1500);
    } else {
      nextTexts = textElementsRef.current.map((t) =>
        t.id === current.id
          ? {
            ...t,
            content: cleanContent,
            color: current.color || t.color,
            fontSize: current.fontSize || t.fontSize,
            hasBg: current.hasBg ?? t.hasBg,
          }
          : t
      );
      setSelectedTextId(current.id);
    }

    pushUndoState(nextTexts);
    setTextElements(nextTexts);
    textElementsRef.current = nextTexts;
    triggerSave(nextTexts);
    setEditingText(null);
    editingTextRef.current = null;
  }, [activeColor.hex, activeFontSize, textHasBg, pushUndoState, triggerSave]);

  const handleCancelEditingText = useCallback(() => {
    setEditingText(null);
    editingTextRef.current = null;
  }, []);

  const handleInlineKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommitEditingText();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEditingText();
    }
  };

  const handleInlineBlur = () => {
    setTimeout(() => {
      // If user clicked a toolbar control (color/size/tag), keep input active
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      handleCommitEditingText();
    }, 120);
  };

  // ── Undo / Redo Execution ───────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const currentSnapshot = {
      image: canvas.toDataURL("image/webp", 0.9),
      texts: JSON.parse(JSON.stringify(textElementsRef.current)),
    };
    redoStack.current.push(currentSnapshot);
    setCanRedo(true);

    const previousState = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (previousState) {
      const prevImage =
        typeof previousState === "string"
          ? previousState
          : previousState.image;
      const prevTexts =
        typeof previousState === "object" && Array.isArray(previousState.texts)
          ? previousState.texts
          : [];

      setTextElements(prevTexts);
      textElementsRef.current = prevTexts;
      setSelectedTextId(null);
      setEditingText(null);
      editingTextRef.current = null;

      if (prevImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
          triggerSave(prevTexts);
        };
        img.src = prevImage;
      } else {
        triggerSave(prevTexts);
      }
    } else {
      setTextElements([]);
      textElementsRef.current = [];
      triggerSave([]);
    }
  }, [triggerSave]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const currentSnapshot = {
      image: canvas.toDataURL("image/webp", 0.9),
      texts: JSON.parse(JSON.stringify(textElementsRef.current)),
    };
    undoStack.current.push(currentSnapshot);
    setCanUndo(true);

    const nextState = redoStack.current.pop();
    setCanRedo(redoStack.current.length > 0);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (nextState) {
      const nextImage =
        typeof nextState === "string" ? nextState : nextState.image;
      const nextTexts =
        typeof nextState === "object" && Array.isArray(nextState.texts)
          ? nextState.texts
          : [];

      setTextElements(nextTexts);
      textElementsRef.current = nextTexts;
      setSelectedTextId(null);
      setEditingText(null);
      editingTextRef.current = null;

      if (nextImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
          triggerSave(nextTexts);
        };
        img.src = nextImage;
      } else {
        triggerSave(nextTexts);
      }
    }
  }, [triggerSave]);

  // ── Paste Image onto Canvas Helper ──────────────────────────────────────────
  const pasteImageFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = baseCanvasRef.current;
          if (!canvas) return;

          pushUndoState();
          const ctx = canvas.getContext("2d");

          const maxW = CANVAS_W * 0.85;
          const maxH = CANVAS_H * 0.85;
          let w = img.width;
          let h = img.height;

          const ratio = Math.min(maxW / w, maxH / h, 1);
          w *= ratio;
          h *= ratio;

          const x = (CANVAS_W - w) / 2;
          const y = (CANVAS_H - h) / 2;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6;
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();

          ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);

          triggerSave();
          setSnapNotification("📸 Chart screenshot pasted onto canvas!");
          setTimeout(() => setSnapNotification(null), 2500);
          if (onToast) onToast("Chart screenshot pasted onto canvas!");
        };
        img.src = event.target?.result;
      };
      reader.readAsDataURL(file);
    },
    [pushUndoState, triggerSave, onToast]
  );

  // ── Load note canvas when noteId or canvasData changes ─────────────────────
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (overlay) {
      overlay.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }

    prevNoteId.current = noteId;
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setSelectedTextId(null);
    setEditingText(null);
    editingTextRef.current = null;

    const saved = canvasData || loadCanvas(noteId);
    if (saved) {
      let imgData = null;
      let loadedTexts = [];

      if (typeof saved === "object" && saved !== null) {
        imgData = saved.image;
        loadedTexts = Array.isArray(saved.texts) ? saved.texts : [];
      } else if (typeof saved === "string") {
        if (saved.startsWith("{")) {
          try {
            const parsed = JSON.parse(saved);
            imgData = parsed.image;
            loadedTexts = Array.isArray(parsed.texts) ? parsed.texts : [];
          } catch {
            imgData = saved;
          }
        } else {
          // Legacy raw dataURL format
          imgData = saved;
        }
      }

      setTextElements(loadedTexts);
      textElementsRef.current = loadedTexts;

      if (imgData) {
        const img = new Image();
        img.onload = () => {
          if (prevNoteId.current === noteId && baseCanvasRef.current) {
            const c = baseCanvasRef.current.getContext("2d");
            c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
          }
        };
        img.src = imgData;
      }
    } else {
      setTextElements([]);
      textElementsRef.current = [];
    }
  }, [noteId, canvasData]);

  // ── Global Keydown Listener (Undo/Redo/Delete/Paste) ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") isShiftPressed.current = true;

      const isInputActive = ["INPUT", "TEXTAREA"].includes(
        document.activeElement?.tagName
      );

      // Delete selected text
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedTextId &&
        !isInputActive
      ) {
        e.preventDefault();
        const nextTexts = textElementsRef.current.filter(
          (t) => t.id !== selectedTextId
        );
        pushUndoState(nextTexts);
        setTextElements(nextTexts);
        textElementsRef.current = nextTexts;
        setSelectedTextId(null);
        triggerSave(nextTexts);
        if (onToast) onToast("Text label removed");
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        if (!isInputActive) {
          e.preventDefault();
          handleUndo();
        }
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (!isInputActive) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Shift") isShiftPressed.current = false;
    };

    const handlePaste = (e) => {
      const targetTag = document.activeElement?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            pasteImageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("paste", handlePaste);
    };
  }, [handleUndo, handleRedo, pasteImageFile, selectedTextId, pushUndoState, triggerSave, onToast]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      pasteImageFile(file);
      e.target.value = "";
    }
  };

  // ── Render Shape Helper (used for preview & final commit) ───────────────────
  const renderShapeOnContext = useCallback(
    (ctx, shape, isPreview = false) => {
      ctx.save();
      ctx.strokeStyle = activeColor.hex;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.type === "line") {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();

        if (isPreview) {
          ctx.fillStyle = activeColor.hex;
          ctx.beginPath();
          ctx.arc(shape.x1, shape.y1, strokeWidth + 2, 0, Math.PI * 2);
          ctx.arc(shape.x2, shape.y2, strokeWidth + 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (shape.type === "rect") {
        if (fillZones) {
          ctx.fillStyle = hexToRgba(activeColor.hex, 0.16);
          ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        }
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(shape.cx, shape.cy, Math.abs(shape.r), 0, Math.PI * 2);
        if (fillZones) {
          ctx.fillStyle = hexToRgba(activeColor.hex, 0.12);
          ctx.fill();
        }
        ctx.stroke();
      } else if (shape.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          shape.cx,
          shape.cy,
          Math.abs(shape.rx),
          Math.abs(shape.ry),
          0,
          0,
          Math.PI * 2
        );
        if (fillZones) {
          ctx.fillStyle = hexToRgba(activeColor.hex, 0.12);
          ctx.fill();
        }
        ctx.stroke();
      }

      ctx.restore();
    },
    [activeColor, strokeWidth, fillZones]
  );

  // ── Smart Shape Recognition (Auto-Snap after 600ms hold) ────────────────────
  const attemptSmartShapeRecognition = useCallback(() => {
    const pts = strokePoints.current;
    if (pts.length < 5) return;

    const p0 = pts[0];
    const pEnd = pts[pts.length - 1];

    let pathLen = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      pathLen += Math.sqrt(dx * dx + dy * dy);
    }

    const directDx = pEnd.x - p0.x;
    const directDy = pEnd.y - p0.y;
    const directDist = Math.sqrt(directDx * directDx + directDy * directDy);

    let minX = pts[0].x,
      maxX = pts[0].x,
      minY = pts[0].y,
      maxY = pts[0].y;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    const boxW = maxX - minX;
    const boxH = maxY - minY;

    const isClosed = directDist < Math.max(45, pathLen * 0.25) && pathLen > 80;

    const overlay = overlayCanvasRef.current;
    const oCtx = overlay ? overlay.getContext("2d") : null;
    if (!oCtx) return;

    if (isClosed) {
      const aspectRatio = boxW / (boxH || 1);
      if (aspectRatio >= 0.75 && aspectRatio <= 1.35) {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const radius = Math.max(boxW, boxH) / 2;

        snappedShape.current = {
          type: "circle",
          cx: centerX,
          cy: centerY,
          r: radius,
        };

        oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        renderShapeOnContext(oCtx, snappedShape.current, true);
        setSnapNotification("✨ Auto-Snapped to Circle!");
        setTimeout(() => setSnapNotification(null), 1500);
        return;
      } else {
        snappedShape.current = {
          type: "rect",
          x: minX,
          y: minY,
          w: boxW,
          h: boxH,
        };

        oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        renderShapeOnContext(oCtx, snappedShape.current, true);
        setSnapNotification("✨ Auto-Snapped to Order Block Zone!");
        setTimeout(() => setSnapNotification(null), 1500);
        return;
      }
    }

    if (directDist > 50 && directDist / pathLen > 0.82) {
      snappedShape.current = {
        type: "line",
        x1: p0.x,
        y1: p0.y,
        x2: pEnd.x,
        y2: pEnd.y,
      };

      oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderShapeOnContext(oCtx, snappedShape.current, true);
      setSnapNotification("✨ Auto-Snapped to Trendline!");
      setTimeout(() => setSnapNotification(null), 1500);
    }
  }, [renderShapeOnContext]);

  // ── Shift Angle Constraint for Trendline: 0°, 45°, 90° strictly ────────────
  const getConstrainedEndPos = (start, current) => {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return current;

    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const snappedAngleDeg = Math.round(angleDeg / 45) * 45;
    const rad = (snappedAngleDeg * Math.PI) / 180;

    return {
      x: start.x + dist * Math.cos(rad),
      y: start.y + dist * Math.sin(rad),
    };
  };

  const handleDeleteText = (id) => {
    const nextTexts = textElementsRef.current.filter((t) => t.id !== id);
    pushUndoState(nextTexts);
    setTextElements(nextTexts);
    textElementsRef.current = nextTexts;
    if (selectedTextId === id) setSelectedTextId(null);
    triggerSave(nextTexts);
    if (onToast) onToast("Text label deleted");
  };

  const handleUpdateSelectedProperty = (patch) => {
    if (!selectedTextId) return;
    const nextTexts = textElementsRef.current.map((t) =>
      t.id === selectedTextId ? { ...t, ...patch } : t
    );
    pushUndoState(nextTexts);
    setTextElements(nextTexts);
    textElementsRef.current = nextTexts;
    triggerSave(nextTexts);
  };

  // ── Drag & Drop Text Handlers ───────────────────────────────────────────────
  const handleTextPointerDown = (e, item) => {
    e.stopPropagation();

    if (activeTool === CANVAS_TOOLS.ERASER) {
      handleDeleteText(item.id);
      return;
    }

    // If an inline input was open, commit it first
    if (editingText) {
      handleCommitEditingText();
    }

    setSelectedTextId(item.id);

    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);

    dragRef.current = {
      id: item.id,
      startX: item.x,
      startY: item.y,
      startClientX: clientX,
      startClientY: clientY,
      hasMoved: false,
    };

    const handlePointerMove = (moveEvent) => {
      if (!dragRef.current || dragRef.current.id !== item.id) return;
      const canvas = baseCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = CANVAS_W / rect.width;
      const sy = CANVAS_H / rect.height;

      const currentX =
        moveEvent.clientX ??
        (moveEvent.touches ? moveEvent.touches[0].clientX : 0);
      const currentY =
        moveEvent.clientY ??
        (moveEvent.touches ? moveEvent.touches[0].clientY : 0);

      const dx = (currentX - dragRef.current.startClientX) * sx;
      const dy = (currentY - dragRef.current.startClientY) * sy;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragRef.current.hasMoved = true;
        const nextX = Math.round(
          Math.max(25, Math.min(CANVAS_W - 25, dragRef.current.startX + dx))
        );
        const nextY = Math.round(
          Math.max(15, Math.min(CANVAS_H - 15, dragRef.current.startY + dy))
        );

        setTextElements((prev) => {
          const updated = prev.map((t) =>
            t.id === item.id ? { ...t, x: nextX, y: nextY } : t
          );
          textElementsRef.current = updated;
          return updated;
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);

      if (dragRef.current?.hasMoved) {
        pushUndoState(textElementsRef.current);
        triggerSave(textElementsRef.current);
      }
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);
  };

  // Double click turns the permanent text back into direct in-place editable field
  const handleTextDoubleClick = (e, item) => {
    e.stopPropagation();
    setSelectedTextId(item.id);
    const editObj = {
      id: item.id,
      x: item.x,
      y: item.y,
      content: item.content,
      isNew: false,
      color: item.color || activeColor.hex,
      fontSize: item.fontSize || activeFontSize,
      hasBg: item.hasBg ?? textHasBg,
    };
    setEditingText(editObj);
    editingTextRef.current = editObj;
  };

  // ── Offscreen Text Renderer for Image Export ────────────────────────────────
  const renderTextOnContext = (ctx, item) => {
    const { content, x, y, color, fontSize = 18, hasBg = true } = item;
    if (!content) return;
    const lines = content.split("\n");

    const canvasFontSize = Math.round(fontSize * 1.8);
    ctx.save();
    ctx.font = `bold ${canvasFontSize}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let maxW = 0;
    lines.forEach((l) => {
      const m = ctx.measureText(l);
      if (m.width > maxW) maxW = m.width;
    });

    const lineH = canvasFontSize * 1.35;
    const totalH = lines.length * lineH;
    const padX = 18;
    const padY = 10;

    if (hasBg) {
      const rx = x - maxW / 2 - padX;
      const ry = y - totalH / 2 - padY;
      const rw = maxW + padX * 2;
      const rh = totalH + padY * 2;
      const radius = 8;

      ctx.fillStyle = "rgba(18, 22, 34, 0.92)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, radius);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.stroke();
    } else {
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = color || "#ffffff";
    const startY = y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((l, idx) => {
      ctx.fillText(l, x, startY + idx * lineH);
    });

    ctx.restore();
  };

  // ── Canvas-to-Image Export (PNG Download) ───────────────────────────────────
  const handleExportImage = () => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_W;
    exportCanvas.height = CANVAS_H;
    const ctx = exportCanvas.getContext("2d");

    // 1. Dark TradingView canvas background
    ctx.fillStyle = "#131722";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 2. Draw subtle grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // 3. Draw base canvas (drawings, shapes, pasted chart screenshots)
    ctx.drawImage(canvas, 0, 0);

    // 4. Render all text & zone labels
    textElements.forEach((item) => {
      renderTextOnContext(ctx, item);
    });

    // 5. Watermark branding
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.font = "bold 13px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("XAU/USD Trading Terminal", CANVAS_W - 20, CANVAS_H - 16);

    // 6. Download PNG
    const link = document.createElement("a");
    link.download = `XAUUSD_Chart_Markup_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();

    if (onToast) onToast("Chart markup exported as high-res PNG!");
  };

  // ── MOUSE / TOUCH EVENTS ────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    // If an inline input is currently open, commit it when clicking outside
    if (editingText) {
      handleCommitEditingText();
      return;
    }

    const pos = getPos(e);

    // ── DIRECT ON-CANVAS TYPING TRIGGER ──
    if (activeTool === CANVAS_TOOLS.TEXT) {
      e.preventDefault();
      setSelectedTextId(null);

      // Mount direct inline input at exact click position
      const initialContent = stagedQuickTag || "";
      const newEdit = {
        id: uid(),
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        content: initialContent,
        isNew: true,
        color: activeColor.hex,
        fontSize: activeFontSize,
        hasBg: textHasBg,
      };
      setEditingText(newEdit);
      editingTextRef.current = newEdit;
      setStagedQuickTag(null);
      return;
    }

    // Deselect any selected text when clicking on empty canvas
    if (selectedTextId) {
      setSelectedTextId(null);
    }

    // Standard drawing tools
    e.preventDefault();
    isDrawing.current = true;
    startPos.current = pos;
    lastPos.current = pos;
    snappedShape.current = null;
    strokePoints.current = [pos];

    pushUndoState();

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      overlay.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (activeTool === CANVAS_TOOLS.PEN) {
      clearTimeout(autoSnapTimer.current);
      autoSnapTimer.current = setTimeout(() => {
        attemptSmartShapeRecognition();
      }, 600);
    }
  };

  const onMouseMove = (e) => {
    if (activeTool === CANVAS_TOOLS.TEXT) return;
    if (!isDrawing.current || !startPos.current) return;
    e.preventDefault();

    const currentPos = getPos(e);
    strokePoints.current.push(currentPos);

    if (activeTool === CANVAS_TOOLS.PEN && !snappedShape.current) {
      clearTimeout(autoSnapTimer.current);
      autoSnapTimer.current = setTimeout(() => {
        attemptSmartShapeRecognition();
      }, 600);
    }

    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!base || !overlay) return;

    const bCtx = base.getContext("2d");
    const oCtx = overlay.getContext("2d");

    if (activeTool === CANVAS_TOOLS.PEN) {
      if (snappedShape.current) {
        oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        renderShapeOnContext(oCtx, snappedShape.current, true);
      } else {
        bCtx.save();
        bCtx.beginPath();
        bCtx.moveTo(lastPos.current.x, lastPos.current.y);
        bCtx.lineTo(currentPos.x, currentPos.y);
        bCtx.strokeStyle = activeColor.hex;
        bCtx.lineWidth = strokeWidth;
        bCtx.lineCap = "round";
        bCtx.lineJoin = "round";
        bCtx.stroke();
        bCtx.restore();
        lastPos.current = currentPos;
      }
      return;
    }

    if (activeTool === CANVAS_TOOLS.ERASER) {
      bCtx.save();
      bCtx.globalCompositeOperation = "destination-out";
      bCtx.beginPath();
      bCtx.arc(currentPos.x, currentPos.y, strokeWidth * 4, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();
      lastPos.current = currentPos;
      return;
    }

    oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (activeTool === CANVAS_TOOLS.LINE) {
      const endPos =
        e.shiftKey || isShiftPressed.current
          ? getConstrainedEndPos(startPos.current, currentPos)
          : currentPos;

      renderShapeOnContext(
        oCtx,
        {
          type: "line",
          x1: startPos.current.x,
          y1: startPos.current.y,
          x2: endPos.x,
          y2: endPos.y,
        },
        true
      );
    } else if (activeTool === CANVAS_TOOLS.RECT) {
      let w = currentPos.x - startPos.current.x;
      let h = currentPos.y - startPos.current.y;
      if (e.shiftKey || isShiftPressed.current) {
        const side = Math.max(Math.abs(w), Math.abs(h));
        w = side * (w < 0 ? -1 : 1);
        h = side * (h < 0 ? -1 : 1);
      }
      renderShapeOnContext(
        oCtx,
        {
          type: "rect",
          x: w < 0 ? startPos.current.x + w : startPos.current.x,
          y: h < 0 ? startPos.current.y + h : startPos.current.y,
          w: Math.abs(w),
          h: Math.abs(h),
        },
        true
      );
    } else if (activeTool === CANVAS_TOOLS.CIRCLE) {
      const rx = (currentPos.x - startPos.current.x) / 2;
      const ry = (currentPos.y - startPos.current.y) / 2;
      const cx = startPos.current.x + rx;
      const cy = startPos.current.y + ry;

      if (e.shiftKey || isShiftPressed.current) {
        const r = Math.max(Math.abs(rx), Math.abs(ry));
        renderShapeOnContext(oCtx, { type: "circle", cx, cy, r }, true);
      } else {
        renderShapeOnContext(oCtx, { type: "ellipse", cx, cy, rx, ry }, true);
      }
    }
  };

  const onMouseUp = (e) => {
    if (activeTool === CANVAS_TOOLS.TEXT) return;
    if (!isDrawing.current) return;
    isDrawing.current = false;
    clearTimeout(autoSnapTimer.current);

    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!base || !overlay) return;

    const bCtx = base.getContext("2d");
    const oCtx = overlay.getContext("2d");
    const currentPos = getPos(e);

    if (snappedShape.current) {
      renderShapeOnContext(bCtx, snappedShape.current, false);
      snappedShape.current = null;
    } else if (startPos.current) {
      if (activeTool === CANVAS_TOOLS.LINE) {
        const endPos =
          e?.shiftKey || isShiftPressed.current
            ? getConstrainedEndPos(startPos.current, currentPos)
            : currentPos;

        renderShapeOnContext(bCtx, {
          type: "line",
          x1: startPos.current.x,
          y1: startPos.current.y,
          x2: endPos.x,
          y2: endPos.y,
        });
      } else if (activeTool === CANVAS_TOOLS.RECT) {
        let w = currentPos.x - startPos.current.x;
        let h = currentPos.y - startPos.current.y;
        if (e?.shiftKey || isShiftPressed.current) {
          const side = Math.max(Math.abs(w), Math.abs(h));
          w = side * (w < 0 ? -1 : 1);
          h = side * (h < 0 ? -1 : 1);
        }
        renderShapeOnContext(bCtx, {
          type: "rect",
          x: w < 0 ? startPos.current.x + w : startPos.current.x,
          y: h < 0 ? startPos.current.y + h : startPos.current.y,
          w: Math.abs(w),
          h: Math.abs(h),
        });
      } else if (activeTool === CANVAS_TOOLS.CIRCLE) {
        const rx = (currentPos.x - startPos.current.x) / 2;
        const ry = (currentPos.y - startPos.current.y) / 2;
        const cx = startPos.current.x + rx;
        const cy = startPos.current.y + ry;

        if (e?.shiftKey || isShiftPressed.current) {
          const r = Math.max(Math.abs(rx), Math.abs(ry));
          renderShapeOnContext(bCtx, { type: "circle", cx, cy, r });
        } else {
          renderShapeOnContext(bCtx, { type: "ellipse", cx, cy, rx, ry });
        }
      }
    }

    oCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    startPos.current = null;
    lastPos.current = null;
    strokePoints.current = [];

    triggerSave();
  };

  const handleClear = () => {
    const canvas = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (canvas) {
      pushUndoState([]);
      canvas.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (overlay) {
      overlay.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    setTextElements([]);
    textElementsRef.current = [];
    setSelectedTextId(null);
    setEditingText(null);
    editingTextRef.current = null;
    saveCanvasToLS(noteId, null);
    onSaveCanvas?.(null);
    setShowClearConfirm(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col bg-[#131722] border-l border-[#2a2e39] select-none overflow-hidden"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ── TRADINGVIEW-STYLE FLOATING TOOLBAR DOCK ── */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#2a2e39] bg-[#1a1e2b]/95 px-3 py-2 backdrop-blur-md">
        {/* Tools Selection */}
        <div className="flex items-center gap-1 rounded-lg border border-[#2a2e39] bg-[#131722]/80 p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.PEN)}
            title="Freehand Pen (Smart auto-snap on 600ms hold)"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.PEN
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Brush className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.LINE)}
            title="Straight Trendline (Hold Shift to snap strictly to 0°, 45°, 90°)"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.LINE
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Minus className="h-3.5 w-3.5 rotate-[-25deg]" />
            <span className="hidden sm:inline">Trendline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.RECT)}
            title="Order Block / S/R Zone Rectangle"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.RECT
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Square className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Zone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.CIRCLE)}
            title="Liquidity Sweep Circle / Ellipse"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.CIRCLE
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Circle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Liquidity</span>
          </button>

          {/* Text Tool Button */}
          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.TEXT)}
            title="Text & Zone Label Tool (Click canvas to type directly on chart)"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.TEXT
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Type className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.ERASER)}
            title="Eraser tool (erases strokes and clicks to remove text labels)"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${activeTool === CANVAS_TOOLS.ERASER
                ? "bg-rose-500 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#2a2e39] bg-[#131722]/80 px-2 py-1">
          {STROKE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveColor(c);
                if (activeTool === CANVAS_TOOLS.ERASER)
                  setActiveTool(CANVAS_TOOLS.PEN);
                if (editingText) {
                  setEditingText((prev) => ({ ...prev, color: c.hex }));
                }
                if (selectedTextId) {
                  handleUpdateSelectedProperty({ color: c.hex });
                }
              }}
              title={c.label}
              className="cursor-pointer rounded-full transition-transform hover:scale-125"
              style={{
                width: 16,
                height: 16,
                backgroundColor: c.hex,
                border:
                  activeColor.id === c.id
                    ? "2px solid #ffffff"
                    : "2px solid transparent",
                transform: activeColor.id === c.id ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}

          <label
            title="Custom Hex Color"
            className="cursor-pointer relative flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400"
          >
            <input
              type="color"
              value={activeColor.hex}
              onChange={(e) => {
                const hexVal = e.target.value;
                setActiveColor({
                  id: "custom",
                  hex: hexVal,
                  label: "Custom",
                });
                if (editingText) {
                  setEditingText((prev) => ({ ...prev, color: hexVal }));
                }
                if (selectedTextId) {
                  handleUpdateSelectedProperty({ color: hexVal });
                }
              }}
              className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
            />
          </label>
        </div>

        {/* Dynamic Context Controls: Text Font Size & Badge Toggle OR Stroke Width Slider */}
        {activeTool === CANVAS_TOOLS.TEXT ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#2a2e39] bg-[#131722]/80 px-2 py-1">
            {/* Font size presets: S(14px), M(18px), L(24px) */}
            <div className="flex items-center gap-0.5">
              {TEXT_FONT_SIZES.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveFontSize(sz.px);
                    if (editingText) {
                      setEditingText((prev) => ({ ...prev, fontSize: sz.px }));
                    }
                    if (selectedTextId) {
                      handleUpdateSelectedProperty({ fontSize: sz.px });
                    }
                  }}
                  title={sz.title}
                  className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${activeFontSize === sz.px
                      ? "bg-amber-500 text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-white"
                    }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            {/* Background badge toggle */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const nextBg = !textHasBg;
                setTextHasBg(nextBg);
                if (editingText) {
                  setEditingText((prev) => ({ ...prev, hasBg: nextBg }));
                }
                if (selectedTextId) {
                  handleUpdateSelectedProperty({ hasBg: nextBg });
                }
              }}
              title="Toggle Semi-Transparent Zone Badge Pill"
              className={`cursor-pointer flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${textHasBg
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "text-zinc-500 border-zinc-800 hover:text-zinc-300"
                }`}
            >
              <Tag className="h-2.5 w-2.5" />
              Badge
            </button>

            {/* Delete selected text button */}
            {selectedTextId && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleDeleteText(selectedTextId)}
                title="Delete selected label (Del/Backspace)"
                className="cursor-pointer flex items-center gap-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 text-[10px] font-bold hover:bg-rose-500/30"
              >
                <Trash2 className="h-2.5 w-2.5" />
                Del
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[#2a2e39] bg-[#131722]/80 px-2.5 py-1">
            <span className="text-[10px] font-mono text-zinc-400 font-bold">
              {strokeWidth}px
            </span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.5"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
              className="w-14 accent-amber-500 cursor-pointer"
              title="Stroke Width"
            />

            <button
              type="button"
              onClick={() => setFillZones((v) => !v)}
              title="Toggle Order Block Fill"
              className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${fillZones
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "text-zinc-500 border-zinc-800"
                }`}
            >
              <Layers className="h-3 w-3 inline mr-0.5" />
              Fill
            </button>
          </div>
        )}

        {/* Actions: Undo, Redo, Paste Chart, Export Image, Clear */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`cursor-pointer rounded-lg p-1.5 transition-colors ${canUndo
                ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                : "text-zinc-600 cursor-not-allowed"
              }`}
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`cursor-pointer rounded-lg p-1.5 transition-colors ${canRedo
                ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                : "text-zinc-600 cursor-not-allowed"
              }`}
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Paste / Upload Screenshot (or press Ctrl+V anywhere)"
            className="cursor-pointer flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Paste</span>
          </button>

          {/* Export / Download Canvas Image button */}
          <button
            type="button"
            onClick={handleExportImage}
            title="Export & Download High-Resolution Chart Markup (PNG)"
            className="cursor-pointer flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            title="Clear all drawings and labels"
            className="cursor-pointer rounded-lg p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── SUB-BAR: QUICK ZONE TAGS & TIPS ── */}
      <div className="flex items-center justify-between border-b border-[#2a2e39]/50 bg-[#151924] px-3 py-1 text-[10.5px] text-zinc-400 min-h-[30px] gap-2">
        {activeTool === CANVAS_TOOLS.TEXT ? (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none w-full">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 shrink-0 mr-1">
              <Tag className="h-3 w-3" />
              Quick Tags:
            </span>
            {QUICK_ZONE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (editingText) {
                    setEditingText((prev) => ({
                      ...prev,
                      content: prev.content ? `${prev.content} ${tag}` : tag,
                    }));
                    setTimeout(() => inlineInputRef.current?.focus(), 50);
                    return;
                  }
                  if (stagedQuickTag === tag) {
                    setStagedQuickTag(null);
                  } else {
                    setStagedQuickTag(tag);
                    if (selectedTextId) {
                      handleUpdateSelectedProperty({ content: tag });
                    }
                  }
                }}
                title={`Click to type '${tag}' into active input or click canvas`}
                className={`cursor-pointer shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all border ${stagedQuickTag === tag
                    ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)] scale-105"
                    : "bg-[#1a1e2b] text-zinc-300 border-[#2a2e39] hover:bg-[#252a3a] hover:text-white hover:border-zinc-600"
                  }`}
              >
                {tag}
              </button>
            ))}
            {stagedQuickTag && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setStagedQuickTag(null)}
                title="Cancel preset staging"
                className="cursor-pointer text-[9.5px] font-semibold text-rose-400 hover:text-rose-300 hover:underline ml-1 shrink-0"
              >
                Clear ({stagedQuickTag})
              </button>
            )}
            <span className="ml-auto text-[10px] text-zinc-500 font-mono hidden md:inline shrink-0">
              Click canvas to type directly · Enter to save · Shift+Enter newline · Esc cancel
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-zinc-400">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: activeColor.hex }}
                />
                {activeColor.label}
              </span>
              <span className="text-zinc-600">·</span>
              <span>
                {activeTool === CANVAS_TOOLS.LINE
                  ? "Hold Shift to constrain to 0° (Horiz), 45° (Diag), 90° (Vert)"
                  : activeTool === CANVAS_TOOLS.PEN
                    ? "Smart Auto-Snap: hold pointer 600ms at end to convert rough strokes"
                    : activeTool === CANVAS_TOOLS.RECT
                      ? "Order Block: click and drag zone"
                      : activeTool === CANVAS_TOOLS.CIRCLE
                        ? "Liquidity Sweep: hold Shift for perfect circle"
                        : "Eraser tool active (click text or drag over strokes to remove)"}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
              <span>Ctrl+V paste screenshot</span>
            </div>
          </>
        )}
      </div>

      {/* ── CANVAS VIEWPORT WITH DUAL LAYERS & DIRECT ON-CANVAS TYPING ── */}
      <div className="relative flex-1 bg-[#131722] overflow-hidden">
        {/* TradingView background grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Base Drawing & Pasted Chart Canvas */}
        <canvas
          ref={baseCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ display: "block" }}
        />

        {/* Overlay Drawing Canvas for shape previews & stroke interaction */}
        <canvas
          ref={overlayCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={`absolute inset-0 h-full w-full touch-none ${activeTool === CANVAS_TOOLS.TEXT ? "cursor-text" : "cursor-crosshair"
            }`}
          style={{ display: "block" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />

        {/* ── INTERACTIVE TEXT LABELS & DIRECT ON-CANVAS INLINE INPUT ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Render permanent saved text elements */}
          {textElements.map((item) => {
            const isSelected = selectedTextId === item.id;
            const isBeingEdited = editingText && editingText.id === item.id;
            if (isBeingEdited) return null; // hidden while being edited inline

            const displayFontSize = Math.round(
              (item.fontSize || 18) * Math.max(0.65, Math.min(1.5, canvasScale))
            );

            return (
              <div
                key={item.id}
                onPointerDown={(e) => handleTextPointerDown(e, item)}
                onDoubleClick={(e) => handleTextDoubleClick(e, item)}
                title={
                  activeTool === CANVAS_TOOLS.ERASER
                    ? "Click to delete label"
                    : "Drag to move · Double-click to edit · Del to delete"
                }
                className={`pointer-events-auto absolute transition-shadow select-none ${activeTool === CANVAS_TOOLS.ERASER
                    ? "cursor-not-allowed hover:opacity-50"
                    : "cursor-grab active:cursor-grabbing"
                  } ${item.hasBg
                    ? "rounded-md bg-[#121622]/90 backdrop-blur-md border border-white/20 shadow-lg px-2.5 py-1"
                    : "px-1 py-0.5"
                  } ${isSelected
                    ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#131722] border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] z-30"
                    : "z-10 hover:border-zinc-400"
                  }`}
                style={{
                  left: `${(item.x / CANVAS_W) * 100}%`,
                  top: `${(item.y / CANVAS_H) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  color: item.color || "#ffffff",
                  fontSize: `${displayFontSize}px`,
                  textShadow: item.hasBg
                    ? "none"
                    : "0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85)",
                }}
              >
                <span className="font-mono font-bold tracking-tight whitespace-pre-wrap leading-tight">
                  {item.content}
                </span>

                {/* Direct delete button badge when selected */}
                {isSelected && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteText(item.id);
                    }}
                    title="Delete label (Delete/Backspace)"
                    className="cursor-pointer absolute -top-2.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 hover:scale-110 transition-transform"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* ── DIRECT ON-CANVAS INLINE INPUT FIELD (NO MODAL / NO POPUP CARD) ── */}
          {editingText && (
            <div
              className="pointer-events-auto absolute select-none z-40"
              style={{
                left: `${(editingText.x / CANVAS_W) * 100}%`,
                top: `${(editingText.y / CANVAS_H) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <textarea
                ref={inlineInputRef}
                rows={1}
                value={editingText.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingText((prev) => ({ ...prev, content: val }));
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.max(28, e.target.scrollHeight)}px`;
                }}
                onKeyDown={handleInlineKeyDown}
                onBlur={handleInlineBlur}
                placeholder="Type..."
                className={`font-mono font-bold tracking-tight outline-none resize-none overflow-hidden text-center transition-all ${editingText.hasBg
                    ? "rounded-md bg-[#121622]/95 backdrop-blur-md border-2 border-amber-400 px-3 py-1 shadow-[0_0_16px_rgba(245,158,11,0.5)]"
                    : "bg-transparent border-b-2 border-amber-400 border-dashed px-1 py-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                  }`}
                style={{
                  color: editingText.color || activeColor.hex,
                  fontSize: `${Math.round(
                    (editingText.fontSize || activeFontSize) *
                    Math.max(0.65, Math.min(1.5, canvasScale))
                  )}px`,
                  minWidth: "75px",
                  maxWidth: "450px",
                  width: `${Math.max(
                    75,
                    (editingText.content?.length || 9) *
                    Math.round(
                      (editingText.fontSize || activeFontSize) *
                      Math.max(0.65, Math.min(1.5, canvasScale)) *
                      0.65
                    ) + 28
                  )}px`,
                  lineHeight: 1.25,
                }}
              />
            </div>
          )}
        </div>

        {/* Auto-Snap notification */}
        {snapNotification && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-900/90 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-xl backdrop-blur-md animate-bounce">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>{snapNotification}</span>
          </div>
        )}
      </div>

      {/* ── Clear Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2a2e39] bg-[#1a1e2b] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              Clear Drawing Canvas?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              This will erase all drawn trendlines, order blocks, pasted chart
              screenshots, and text labels on this note.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="cursor-pointer rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Erase Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
