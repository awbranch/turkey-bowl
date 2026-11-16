"use client";

import Link from "next/link";
import { Button, ErrorText } from "@/components/ui";
import { addRoundAction, removeLastRoundAction } from "./actions";
import { useAction } from "./useAction";

type RoundSummary = { id: number; number: number; status: string; teamCount: number; assignedCount: number };

export function RoundsList({ rounds, bowlerCount, maxRounds }: { rounds: RoundSummary[]; bowlerCount: number; maxRounds: number }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-3">
        {rounds.map((r) => {
          const unassigned = bowlerCount - r.assignedCount;
          return (
            <li key={r.id}>
              <Link
                href={`/admin/round/${r.number}/teams`}
                className="flex flex-col gap-1 rounded-xl border-2 border-bark/10 bg-cream p-4 hover:border-pumpkin"
              >
                <span className="text-lg font-bold">Round {r.number}</span>
                <span className="text-bark/70">
                  {r.teamCount} {r.teamCount === 1 ? "team" : "teams"}
                </span>
                <span className={unassigned > 0 ? "text-cranberry" : "text-green-700"}>
                  {bowlerCount === 0
                    ? "No bowlers yet"
                    : unassigned > 0
                      ? `${unassigned} not on a team`
                      : "Everyone's on a team"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {rounds.length < maxRounds && (
          <Button variant="secondary" disabled={pending} onClick={() => run(addRoundAction)}>
            + Add round {rounds.length + 1}
          </Button>
        )}
        {rounds.length > 1 && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove round ${rounds.length}?`)) run(removeLastRoundAction);
            }}
          >
            Remove round {rounds.length}
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
