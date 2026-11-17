"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Scorecard } from "@/components/Scorecard";
import { analyzeGame, type Roll } from "@/lib/bowling";
import { Keypad } from "./Keypad";
import { useGameSync, type SyncStatus } from "./useGameSync";

type Bowler = { id: number; name: string; nickname: string | null; rolls: Roll[] };

type Props = {
  token: string;
  roundId: number;
  roundNumber: number;
  team: { id: number; name: string; color: string | null };
  bowlers: Bowler[];
};

const label = (b: { name: string; nickname: string | null }) => b.nickname || b.name;
const framesDone = (rolls: Roll[]) => analyzeGame(rolls).frames.filter((f) => f.isComplete).length;

/** Whoever has bowled the fewest frames goes next (team order breaks ties); null when everyone's done. */
function nextUp(bowlers: Bowler[], rolls: Record<number, Roll[]>): number | null {
  let best: { id: number; done: number } | null = null;
  for (const b of bowlers) {
    const r = rolls[b.id] ?? [];
    if (analyzeGame(r).isComplete) continue;
    const done = framesDone(r);
    if (!best || done < best.done) best = { id: b.id, done };
  }
  return best?.id ?? null;
}

export function TeamScorer({ token, roundId, roundNumber, team, bowlers }: Props) {
  const [rolls, setRolls] = useState<Record<number, Roll[]>>(() =>
    Object.fromEntries(bowlers.map((b) => [b.id, b.rolls])),
  );
  const [selected, setSelected] = useState<number | null>(() =>
    nextUp(bowlers, Object.fromEntries(bowlers.map((b) => [b.id, b.rolls]))),
  );
  const [history, setHistory] = useState<number[]>([]);
  const { save, status, unsent } = useGameSync(token);

  // Restore anything typed on this phone that didn't reach the server last time.
  useEffect(() => {
    const restore = unsent(roundId).filter((g) => bowlers.some((b) => b.id === g.personId));
    if (!restore.length) return;
    // localStorage is only readable after mount, so this has to be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRolls((prev) => ({ ...prev, ...Object.fromEntries(restore.map((g) => [g.personId, g.rolls])) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember this team so the scorer link can offer "continue" later.
  useEffect(() => {
    try {
      localStorage.setItem(`tb_team_${token}`, JSON.stringify({ roundId, teamId: team.id, name: team.name }));
    } catch {}
  }, [token, roundId, team.id, team.name]);

  const games = useMemo(
    () => Object.fromEntries(bowlers.map((b) => [b.id, analyzeGame(rolls[b.id] ?? [])])),
    [bowlers, rolls],
  );
  const current = selected !== null ? games[selected] : undefined;
  const currentBowler = bowlers.find((b) => b.id === selected);
  const allDone = bowlers.length > 0 && bowlers.every((b) => games[b.id]?.isComplete);

  function setGame(personId: number, next: Roll[]) {
    setRolls((prev) => ({ ...prev, [personId]: next }));
    save({ roundId, personId, rolls: next });
  }

  function roll(r: Roll) {
    if (selected === null) return;
    const before = rolls[selected] ?? [];
    const next = [...before, r];
    setGame(selected, next);
    setHistory((h) => [...h, selected]);
    // Frame finished → hand the keypad to whoever's up next.
    if (framesDone(next) > framesDone(before)) {
      setSelected(nextUp(bowlers, { ...rolls, [selected]: next }));
    }
  }

  function undo() {
    const personId = history.at(-1) ?? selected;
    if (personId === null || personId === undefined) return;
    const prev = rolls[personId] ?? [];
    if (!prev.length) return;
    setHistory((h) => h.slice(0, -1));
    setGame(personId, prev.slice(0, -1));
    setSelected(personId);
  }

  const canUndo = (() => {
    const personId = history.at(-1) ?? selected;
    return personId !== null && personId !== undefined && (rolls[personId]?.length ?? 0) > 0;
  })();

  const ball = current ? (current.frames[(current.currentFrame ?? 1) - 1]?.rolls.length ?? 0) + 1 : 1;

  return (
    <div className="min-h-dvh pb-[22rem]">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 text-white shadow"
        style={{ background: team.color ?? "#57534e" }}
      >
        <Link href={`/s/${token}`} className="text-sm font-semibold opacity-80">
          ‹ Teams
        </Link>
        <h1 className="flex-1 truncate text-xl font-bold">
          {team.name} <span className="text-base font-normal opacity-80">· Round {roundNumber}</span>
        </h1>
        <SyncPill status={status} />
      </header>

      {status.error && <p className="mx-4 mt-3 rounded-lg bg-cranberry/10 px-3 py-2 text-cranberry">{status.error}</p>}

      <ul className="flex flex-col gap-3 p-3">
        {bowlers.map((b) => {
          const game = games[b.id]!;
          const isSelected = b.id === selected;
          return (
            <li key={b.id}>
              <button
                onClick={() => setSelected(b.id)}
                className={`flex w-full flex-col gap-2 rounded-2xl border-2 bg-white p-3 text-left shadow-sm ${
                  isSelected ? "border-pumpkin ring-4 ring-pumpkin/20" : "border-transparent"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{label(b)}</span>
                  <span className="text-lg font-bold">
                    {game.isComplete
                      ? `${game.score} ✓`
                      : game.frames.some((f) => f.cumulative !== null)
                        ? game.score
                        : ""}
                  </span>
                </div>
                <Scorecard game={game} activeFrame={isSelected ? game.currentFrame : null} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-bark/10 bg-cream/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto max-w-md">
          {allDone ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-3xl">🎉</p>
              <p className="text-xl font-bold">Everyone on {team.name} is done!</p>
              {canUndo && (
                <button onClick={undo} className="text-bark/60 underline">
                  Undo last roll
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-2 text-center text-lg">
                {currentBowler && current && !current.isComplete ? (
                  <>
                    <strong>{label(currentBowler)}</strong> · Frame {current.currentFrame}, ball {ball}
                  </>
                ) : (
                  "Tap a bowler"
                )}
              </p>
              <Keypad allowed={current?.allowedNext ?? []} onRoll={roll} onUndo={undo} canUndo={canUndo} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SyncPill({ status }: { status: SyncStatus }) {
  if (status.offline) {
    return <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-cranberry">Offline · {status.pending} waiting</span>;
  }
  if (status.pending) return <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold">Saving…</span>;
  return <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold">Saved ✓</span>;
}
