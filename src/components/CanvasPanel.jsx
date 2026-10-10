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
  Eraser,
  Undo2,
  Redo2,
  RotateCcw,
  Upload,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  CANVAS_TOOLS,
  CANVAS_W,
  CANVAS_H,
  STROKE_COLORS,
  loadCanvas,
  saveCanvasToLS,
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
  const baseCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Undo / Redo stacks
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  // UI state
  const [activeTool, setActiveTool] = useState(CANVAS_TOOLS.PEN);
  const [activeColor, setActiveColor] = useState(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3.5);
  const [fillZones, setFillZones] = useState(true); // Fill rectangles (Order Blocks)
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [snapNotification, setSnapNotification] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── Push current base canvas state to undo stack ────────────────────────────
  const pushUndoState = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/webp", 0.9);
      undoStack.current.push(dataUrl);
      if (undoStack.current.length > 25) {
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
  const triggerSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = baseCanvasRef.current;
      if (!canvas || !noteId) return;
      try {
        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        saveCanvasToLS(noteId, dataUrl);
        onSaveCanvas?.(dataUrl);
      } catch (e) {
        console.warn("Canvas save quota error:", e);
      }
    }, 400);
  }, [noteId, onSaveCanvas]);

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

  // ── Undo / Redo Execution ───────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const currentState = canvas.toDataURL("image/webp", 0.9);
    redoStack.current.push(currentState);
    setCanRedo(true);

    const previousState = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (previousState) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        triggerSave();
      };
      img.src = previousState;
    } else {
      triggerSave();
    }
  }, [triggerSave]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const currentState = canvas.toDataURL("image/webp", 0.9);
    undoStack.current.push(currentState);
    setCanUndo(true);

    const nextState = redoStack.current.pop();
    setCanRedo(redoStack.current.length > 0);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (nextState) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        triggerSave();
      };
      img.src = nextState;
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

    const saved = canvasData || loadCanvas(noteId);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        if (prevNoteId.current === noteId && baseCanvasRef.current) {
          const c = baseCanvasRef.current.getContext("2d");
          c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        }
      };
      img.src = saved;
    }
  }, [noteId, canvasData]);

  // ── Global Shift Key & Clipboard Paste Listener ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") isShiftPressed.current = true;

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          handleUndo();
        }
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (!["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
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
  }, [handleUndo, handleRedo, pasteImageFile]);

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

    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
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

  // ── MOUSE / TOUCH EVENTS ────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
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
      const endPos = (e.shiftKey || isShiftPressed.current)
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
        const endPos = (e?.shiftKey || isShiftPressed.current)
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
      pushUndoState();
      canvas.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (overlay) {
      overlay.getContext("2d").clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    saveCanvasToLS(noteId, null);
    onSaveCanvas?.(null);
    setShowClearConfirm(false);
  };

  return (
    <div className="relative flex h-full flex-col bg-[#131722] border-l border-[#2a2e39] select-none overflow-hidden">
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
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${
              activeTool === CANVAS_TOOLS.PEN
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
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${
              activeTool === CANVAS_TOOLS.LINE
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
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${
              activeTool === CANVAS_TOOLS.RECT
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
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${
              activeTool === CANVAS_TOOLS.CIRCLE
                ? "bg-amber-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <Circle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Liquidity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(CANVAS_TOOLS.ERASER)}
            title="Eraser tool"
            className={`cursor-pointer flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-all ${
              activeTool === CANVAS_TOOLS.ERASER
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
              onClick={() => {
                setActiveColor(c);
                if (activeTool === CANVAS_TOOLS.ERASER) setActiveTool(CANVAS_TOOLS.PEN);
              }}
              title={c.label}
              className="cursor-pointer rounded-full transition-transform hover:scale-125"
              style={{
                width: 16,
                height: 16,
                backgroundColor: c.hex,
                border: activeColor.id === c.id ? "2px solid #ffffff" : "2px solid transparent",
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
              onChange={(e) => setActiveColor({ id: "custom", hex: e.target.value, label: "Custom" })}
              className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
            />
          </label>
        </div>

        {/* Stroke Width Slider & Presets */}
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
            className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
              fillZones
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "text-zinc-500 border-zinc-800"
            }`}
          >
            <Layers className="h-3 w-3 inline mr-0.5" />
            Fill
          </button>
        </div>

        {/* Actions: Undo, Redo, Paste Chart, Clear */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`cursor-pointer rounded-lg p-1.5 transition-colors ${
              canUndo ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`cursor-pointer rounded-lg p-1.5 transition-colors ${
              canRedo ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-zinc-600 cursor-not-allowed"
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
            <span className="hidden sm:inline">Paste Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            title="Clear all drawings"
            className="cursor-pointer rounded-lg p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── SUB-BAR: TIPS & CURRENT TOOL STATE ── */}
      <div className="flex items-center justify-between border-b border-[#2a2e39]/50 bg-[#151924] px-4 py-1 text-[10.5px] text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeColor.hex }} />
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
              : "Eraser tool active"}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
          <span>Ctrl+V paste screenshot</span>
        </div>
      </div>

      {/* ── CANVAS VIEWPORT WITH DUAL LAYERS ── */}
      <div className="relative flex-1 bg-[#131722] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <canvas
          ref={baseCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ display: "block" }}
        />

        <canvas
          ref={overlayCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ display: "block" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />

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
            <h3 className="text-base font-bold text-white mb-2">Clear Drawing Canvas?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              This will erase all drawn trendlines, order blocks, and pasted chart screenshots on this note.
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
