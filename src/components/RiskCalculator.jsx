import React, { useMemo } from "react";
import {
  Calculator,
  DollarSign,
  ShieldAlert,
  PlusCircle,
  X,
  Sliders,
  Scale,
} from "lucide-react";
import { DEFAULT_CALCULATOR } from "../utils/constants";

export default function RiskCalculator({
  settings = DEFAULT_CALCULATOR,
  onChangeSettings,
  onInsertToNote,
  onClose,
  isFloating = false,
}) {
  const {
    balance = 10000,
    riskPercent = 1.0,
    riskDollar = 100,
    riskMode = "percent",
    slPips = 200,
    contractSize = 100,
    goldPrice = 2350,
    leverage = 500,
  } = settings;

  const update = (patch) => {
    if (!onChangeSettings) return;
    const next = { ...settings, ...patch };

    // Synchronize riskDollar vs riskPercent
    if (patch.riskPercent !== undefined && patch.riskDollar === undefined) {
      next.riskDollar = parseFloat(((next.balance * patch.riskPercent) / 100).toFixed(2));
    } else if (patch.riskDollar !== undefined && patch.riskPercent === undefined) {
      next.riskPercent = next.balance > 0
        ? parseFloat(((patch.riskDollar / next.balance) * 100).toFixed(2))
        : 1.0;
    } else if (patch.balance !== undefined) {
      if (next.riskMode === "percent") {
        next.riskDollar = parseFloat(((patch.balance * next.riskPercent) / 100).toFixed(2));
      } else {
        next.riskPercent = patch.balance > 0
          ? parseFloat(((next.riskDollar / patch.balance) * 100).toFixed(2))
          : 1.0;
      }
    }

    onChangeSettings(next);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // XAU/USD MATHEMATICAL FORMULAS
  // ─────────────────────────────────────────────────────────────────────────────
  // Calibration: 1 pip = $0.01 / 10 pips = $0.10 / 100 pips = $1.00 move in gold
  // Contract Size: standard gold = 100 troy oz
  // Dollar Risk = balance * (riskPercent / 100) or fixed riskDollar
  // Price SL distance ($) = slPips * 0.01
  // Lot Size = Dollar Risk / (Price SL distance * Contract Size)
  // Required Margin = (Lot Size * Contract Size * goldPrice) / leverage
  // ─────────────────────────────────────────────────────────────────────────────
  const calculations = useMemo(() => {
    const activeRiskDollar =
      riskMode === "percent"
        ? Math.max(0, (balance * riskPercent) / 100)
        : Math.max(0, riskDollar);

    const safePips = Math.max(1, slPips);
    const slPriceDistance = safePips * 0.01; // e.g. 200 pips * 0.01 = $2.00
    const safeContractSize = Math.max(1, contractSize);

    // Raw lot calculation
    const rawLot = activeRiskDollar / (slPriceDistance * safeContractSize);
    // Standard broker min lot 0.01, rounded to 2 decimals
    const displayLot = Math.max(0.01, parseFloat(rawLot.toFixed(2)));

    // Actual risk at chosen rounded lot
    const actualRisk = displayLot * slPriceDistance * safeContractSize;

    // Required Margin
    const safeLeverage = Math.max(1, leverage);
    const safeGoldPrice = Math.max(1, goldPrice);
    const requiredMargin = (displayLot * safeContractSize * safeGoldPrice) / safeLeverage;

    // Potential profit targets
    const tp1Dollar = activeRiskDollar * 2; // R:R 1:2
    const tp2Dollar = activeRiskDollar * 3; // R:R 1:3

    return {
      activeRiskDollar,
      slPriceDistance,
      displayLot,
      actualRisk,
      requiredMargin,
      tp1Dollar,
      tp2Dollar,
    };
  }, [balance, riskPercent, riskDollar, riskMode, slPips, contractSize, goldPrice, leverage]);

  const handleInsertSummary = () => {
    if (!onInsertToNote) return;
    const summary = `
═══════════════════════════════════════════
  📊 XAU/USD RISK & LOT CALCULATION
═══════════════════════════════════════════
• Account Balance: $${balance.toLocaleString()}
• Risk Parameter:  ${riskPercent}% ($${calculations.activeRiskDollar.toFixed(2)})
• Stop Loss Pips:  ${slPips} pips ($${calculations.slPriceDistance.toFixed(2)} move)
• Recommended Lot: ${calculations.displayLot.toFixed(2)} Lots
• Required Margin: $${calculations.requiredMargin.toFixed(2)} (Leverage 1:${leverage})
• Target 1:2 (TP): +$${calculations.tp1Dollar.toFixed(2)}
• Target 1:3 (TP): +$${calculations.tp2Dollar.toFixed(2)}
───────────────────────────────────────────`;
    onInsertToNote(summary);
  };

  return (
    <div
      className={`flex flex-col bg-[#141822] text-zinc-100 border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden select-none ${
        isFloating ? "w-88 sm:w-96 max-h-[90vh]" : "w-full h-full"
      }`}
    >
      {/* ── Widget Header ── */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] bg-[#1a1e2b] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Risk & Lot Calculator
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">
              Calibrated for XAU/USD (1 pip = $0.01)
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Inputs Section ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Account Balance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-amber-400" />
              Account Balance ($)
            </label>
            <span className="font-mono text-[10px] text-zinc-400">
              ${balance.toLocaleString()}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="100"
              step="100"
              value={balance}
              onChange={(e) => update({ balance: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-[#2a2e39] bg-[#0e1118] px-3 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {[1000, 5000, 10000, 25000, 100000].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => update({ balance: b })}
                className={`cursor-pointer px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                  balance === b
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                ${b >= 1000 ? `${b / 1000}k` : b}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Mode & Value */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-rose-400" />
              Risk Parameter
            </label>
            <div className="flex items-center rounded-md border border-[#2a2e39] bg-[#0e1118] p-0.5">
              <button
                type="button"
                onClick={() => update({ riskMode: "percent" })}
                className={`cursor-pointer px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                  riskMode === "percent"
                    ? "bg-amber-500 text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                % Risk
              </button>
              <button
                type="button"
                onClick={() => update({ riskMode: "dollar" })}
                className={`cursor-pointer px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                  riskMode === "dollar"
                    ? "bg-amber-500 text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                $ Cash
              </button>
            </div>
          </div>

          {riskMode === "percent" ? (
            <div>
              <div className="relative">
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => update({ riskPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-[#2a2e39] bg-[#0e1118] px-3 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-zinc-400">
                  = ${calculations.activeRiskDollar.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update({ riskPercent: p })}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      riskPercent === p
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={riskDollar}
                  onChange={(e) => update({ riskDollar: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-[#2a2e39] bg-[#0e1118] px-3 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-zinc-400">
                  = {riskPercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {[50, 100, 200, 500].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ riskDollar: d })}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      riskDollar === d
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    ${d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stop Loss in Pips */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
              <Sliders className="h-3 w-3 text-sky-400" />
              Stop Loss in Pips
            </label>
            <span className="font-mono text-[10.5px] text-sky-300 font-bold">
              ${calculations.slPriceDistance.toFixed(2)} Gold Move
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="10"
              step="10"
              value={slPips}
              onChange={(e) => update({ slPips: parseInt(e.target.value, 10) || 0 })}
              className="w-full rounded-lg border border-[#2a2e39] bg-[#0e1118] px-3 py-1.5 font-mono text-sm text-white focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
            <span className="absolute right-3 top-2 text-xs font-mono text-zinc-500">
              pips (10 pips = $0.10)
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {[50, 100, 150, 200, 300].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ slPips: p })}
                className={`cursor-pointer px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                  slPips === p
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {p}p (${(p * 0.01).toFixed(2)})
              </button>
            ))}
          </div>
        </div>

        {/* Contract Size, Gold Price & Leverage Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
              Contract Size (oz)
            </label>
            <input
              type="number"
              value={contractSize}
              onChange={(e) => update({ contractSize: parseFloat(e.target.value) || 100 })}
              className="w-full rounded-md border border-[#2a2e39] bg-[#0e1118] px-2.5 py-1 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
              Gold Price ($/oz)
            </label>
            <input
              type="number"
              value={goldPrice}
              onChange={(e) => update({ goldPrice: parseFloat(e.target.value) || 2350 })}
              className="w-full rounded-md border border-[#2a2e39] bg-[#0e1118] px-2.5 py-1 font-mono text-xs text-white"
            />
          </div>
        </div>

        {/* Leverage Selector */}
        <div>
          <label className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mb-1.5">
            <Scale className="h-3 w-3 text-amber-400" />
            Select Broker Leverage:
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[100, 500, 2000].map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => update({ leverage: lev })}
                className={`cursor-pointer py-1 text-center rounded text-xs font-mono font-bold border transition-all ${
                  leverage === lev
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/20"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                1:{lev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── REAL-TIME OUTPUT CARDS ── */}
      <div className="border-t border-[#2a2e39] bg-[#12151f] p-4 space-y-3">
        {/* Recommended Lot Size Highlight */}
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3.5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Recommended Lot Size
              </span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-black text-white">
                  {calculations.displayLot.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-amber-300 font-mono">
                  Standard Lots
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-zinc-400">Total at Risk:</span>
              <div className="font-mono text-sm font-bold text-rose-400">
                ${calculations.actualRisk.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Required Margin & Targets */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="rounded-lg border border-[#2a2e39] bg-[#161a25] p-2">
            <span className="text-[9.5px] text-zinc-400 block uppercase font-bold">
              Req. Margin (1:{leverage})
            </span>
            <span className="text-xs font-bold text-emerald-400">
              ${calculations.requiredMargin.toFixed(2)}
            </span>
          </div>
          <div className="rounded-lg border border-[#2a2e39] bg-[#161a25] p-2">
            <span className="text-[9.5px] text-zinc-400 block uppercase font-bold">
              Target 1:2 R:R (TP)
            </span>
            <span className="text-xs font-bold text-sky-400">
              +${calculations.tp1Dollar.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Insert To Active Note Button */}
        {onInsertToNote && (
          <button
            type="button"
            onClick={handleInsertSummary}
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 py-2 text-xs font-semibold text-amber-300 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>Insert Calculation to Note</span>
          </button>
        )}
      </div>
    </div>
  );
}
