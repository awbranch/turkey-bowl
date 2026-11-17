import type { Frame, GameState } from "@/lib/bowling";

/** Roll marks laid out the way alley screens show them (strike in the right box for frames 1–9). */
function frameMarks(frame: Frame | undefined, number: number): string[] {
  const slots = number === 10 ? 3 : 2;
  const marks = Array<string>(slots).fill("");
  if (!frame) return marks;
  if (number < 10 && frame.isStrike) {
    marks[1] = "X";
    return marks;
  }
  frame.rolls.forEach((r, i) => (marks[i] = r === "-" ? "–" : r));
  return marks;
}

export function Scorecard({ game, activeFrame }: { game: GameState; activeFrame?: number | null }) {
  return (
    <div className="grid grid-cols-[repeat(9,minmax(0,1fr))_minmax(0,1.45fr)] overflow-hidden rounded-lg border border-bark/20 bg-white text-center">
      {Array.from({ length: 10 }, (_, i) => {
        const number = i + 1;
        const frame = game.frames[i];
        const marks = frameMarks(frame, number);
        const active = activeFrame === number;
        return (
          <div key={number} className={`flex flex-col border-bark/20 ${i ? "border-l" : ""} ${active ? "bg-harvest/40" : ""}`}>
            <div className="text-[10px] leading-4 text-bark/40">{number}</div>
            <div className="flex justify-end">
              {marks.map((m, j) => (
                <span
                  key={j}
                  className={`flex h-5 min-w-0 flex-1 items-center justify-center border-bark/20 text-xs font-bold ${
                    j > 0 || number === 10 ? "border-b border-l" : ""
                  } ${m === "X" || m === "/" ? "text-cranberry" : ""}`}
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="h-6 text-sm leading-6 font-semibold">{frame?.cumulative ?? ""}</div>
          </div>
        );
      })}
    </div>
  );
}
