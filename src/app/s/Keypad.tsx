"use client";

import type { Roll } from "@/lib/bowling";

const KEYS: { roll: Roll; label: string; sub?: string; className?: string }[] = [
  { roll: "X", label: "X", sub: "Strike", className: "bg-cranberry text-white" },
  { roll: "/", label: "/", sub: "Spare", className: "bg-pumpkin text-white" },
  { roll: "G", label: "G", sub: "Gutter", className: "bg-bark text-white" },
  { roll: "-", label: "–", sub: "Miss", className: "bg-bark/70 text-white" },
];
const DIGITS: Roll[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Keypad({
  allowed,
  onRoll,
  onUndo,
  canUndo,
}: {
  allowed: Roll[];
  onRoll: (roll: Roll) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const ok = new Set(allowed);
  const key = "flex h-14 select-none flex-col items-center justify-center rounded-xl text-2xl font-bold shadow-sm transition active:scale-95 disabled:opacity-20 disabled:shadow-none";
  return (
    <div className="grid grid-cols-4 gap-2">
      {KEYS.map((k) => (
        <button key={k.roll} disabled={!ok.has(k.roll)} onClick={() => onRoll(k.roll)} className={`${key} ${k.className}`}>
          <span className="leading-none">{k.label}</span>
          <span className="text-[11px] font-semibold uppercase opacity-80">{k.sub}</span>
        </button>
      ))}
      {DIGITS.map((d, i) => (
        <button
          key={d}
          disabled={!ok.has(d)}
          onClick={() => onRoll(d)}
          className={`${key} border-2 border-bark/10 bg-white ${i % 3 === 0 ? "col-start-1" : ""}`}
        >
          {d}
        </button>
      ))}
      <button
        disabled={!canUndo}
        onClick={onUndo}
        className={`${key} col-start-4 row-span-3 row-start-2 h-auto bg-bark/10 text-base`}
      >
        ↶<span className="text-[11px] font-semibold uppercase">Undo</span>
      </button>
    </div>
  );
}
