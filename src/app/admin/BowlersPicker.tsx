"use client";

import { useOptimistic, startTransition } from "react";
import { ErrorText } from "@/components/ui";
import { setBowlingAction } from "./actions";
import { useAction } from "./useAction";

type Person = { id: number; name: string; nickname: string | null };

export function BowlersPicker({ people, bowlingIds }: { people: Person[]; bowlingIds: number[] }) {
  const [optimistic, setOptimistic] = useOptimistic(new Set(bowlingIds), (state, { id, on }: { id: number; on: boolean }) => {
    const next = new Set(state);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });
  const { error, run } = useAction();

  function toggle(id: number) {
    const on = !optimistic.has(id);
    startTransition(() => setOptimistic({ id, on }));
    run(() => setBowlingAction(id, on));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const on = optimistic.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold transition ${
                on ? "border-cranberry bg-cranberry text-white" : "border-bark/15 bg-white text-bark/60"
              }`}
            >
              {on ? "✓ " : ""}
              {p.nickname || p.name}
            </button>
          );
        })}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
