"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { suggestedTeamCount } from "@/lib/teams";
import type { TeamWithMembers } from "@/server/teams";
import {
  assignMemberAction,
  copyTeamsAction,
  createTeamAction,
  deleteTeamAction,
  moveMemberAction,
  renameTeamAction,
  shuffleTeamsAction,
} from "../../../actions";
import { useAction } from "../../../useAction";

type Bowler = { id: number; name: string; nickname: string | null };

type Props = {
  roundNumber: number;
  teams: TeamWithMembers[];
  unassigned: Bowler[];
  bowlerCount: number;
};

const label = (p: { name: string; nickname: string | null }) => p.nickname || p.name;

export function TeamBuilder({ roundNumber, teams, unassigned, bowlerCount }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [teamCount, setTeamCount] = useState(() => teams.length || suggestedTeamCount(bowlerCount));
  const { pending, error, run } = useAction();

  const selectedName = (() => {
    const all = [...unassigned, ...teams.flatMap((t) => t.members)];
    const p = all.find((b) => b.id === selected);
    return p ? label(p) : null;
  })();

  function placeSelected(teamId: number | null) {
    if (selected === null) return;
    const personId = selected;
    setSelected(null);
    run(() => assignMemberAction(roundNumber, personId, teamId));
  }

  const sizes = teams.map((t) => t.members.length);
  const uneven = sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 1;

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-bark/10 bg-white p-3">
        <Button variant="secondary" disabled={pending} onClick={() => run(() => createTeamAction(roundNumber))}>
          + Add team
        </Button>
        {roundNumber > 1 && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!teams.length || confirm(`Replace these teams with round ${roundNumber - 1}'s teams?`)) {
                run(() => copyTeamsAction(roundNumber));
              }
            }}
          >
            Copy round {roundNumber - 1} teams
          </Button>
        )}
        <div className="flex items-center gap-1 rounded-xl border-2 border-bark/15 bg-white pl-3">
          <span className="font-semibold">Shuffle into</span>
          <button
            className="min-h-12 px-3 text-xl font-bold disabled:opacity-30"
            disabled={teamCount <= 1}
            onClick={() => setTeamCount((n) => Math.max(1, n - 1))}
            aria-label="Fewer teams"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-bold">{teamCount}</span>
          <button
            className="min-h-12 px-3 text-xl font-bold disabled:opacity-30"
            disabled={teamCount >= 8}
            onClick={() => setTeamCount((n) => Math.min(8, n + 1))}
            aria-label="More teams"
          >
            +
          </button>
          <Button
            className="rounded-l-none"
            disabled={pending || bowlerCount === 0}
            onClick={() => {
              if (!teams.length || confirm(`Randomly reshuffle all ${bowlerCount} bowlers into ${teamCount} teams?`)) {
                run(() => shuffleTeamsAction(roundNumber, teamCount));
              }
            }}
          >
            🎲 Go
          </Button>
        </div>
        {pending && <span className="text-bark/50">Saving…</span>}
      </div>

      <ErrorText>{error}</ErrorText>

      {/* Fixed so it never shifts tap targets when a bowler is selected */}
      {selected !== null && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
          <p className="flex items-center gap-4 rounded-2xl bg-bark px-5 py-3 text-lg text-white shadow-lg">
            <span>
              Tap a team to move <strong>{selectedName}</strong>
            </span>
            <button className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </p>
        </div>
      )}

      {(unassigned.length > 0 || uneven) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {unassigned.length > 0 && (
            <span className="rounded-full bg-cranberry/10 px-3 py-1 text-cranberry">{unassigned.length} not on a team</span>
          )}
          {uneven && <span className="rounded-full bg-harvest/50 px-3 py-1">Team sizes differ by more than one</span>}
        </div>
      )}

      {/* Unassigned pool */}
      <section
        onClick={() => placeSelected(null)}
        className={`rounded-2xl border-2 border-dashed p-4 ${
          selected !== null ? "cursor-pointer border-pumpkin bg-pumpkin/5" : "border-bark/15"
        }`}
      >
        <h2 className="mb-3 font-bold text-bark/70">Not on a team ({unassigned.length})</h2>
        {unassigned.length === 0 ? (
          <p className="text-bark/50">Everyone&apos;s on a team.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassigned.map((b) => (
              <Chip key={b.id} active={selected === b.id} onClick={() => setSelected(selected === b.id ? null : b.id)}>
                {label(b)}
              </Chip>
            ))}
          </div>
        )}
      </section>

      {/* Teams */}
      {teams.length === 0 ? (
        <p className="text-bark/60">No teams yet. Add teams, shuffle, or copy the last round.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              selected={selected}
              onSelect={setSelected}
              onDrop={() => placeSelected(team.id)}
              run={run}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  selected,
  onSelect,
  onDrop,
  run,
  pending,
}: {
  team: TeamWithMembers;
  selected: number | null;
  onSelect: (id: number | null) => void;
  onDrop: () => void;
  run: ReturnType<typeof useAction>["run"];
  pending: boolean;
}) {
  const droppable = selected !== null && !team.members.some((m) => m.id === selected);
  return (
    <section
      onClick={droppable ? onDrop : undefined}
      className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm ${
        droppable ? "cursor-pointer border-pumpkin ring-4 ring-pumpkin/20" : "border-bark/10"
      }`}
    >
      <header className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: team.color ?? "#57534e" }}>
        <h2 className="flex-1 text-xl font-bold">
          {team.name} <span className="font-normal opacity-80">({team.members.length})</span>
        </h2>
        <button
          className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-white/15"
          onClick={(e) => {
            e.stopPropagation();
            const name = prompt("Team name", team.name);
            if (name && name !== team.name) run(() => renameTeamAction(team.id, name));
          }}
        >
          Rename
        </button>
        <button
          className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-white/15"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${team.name}? Its bowlers go back to "not on a team".`)) run(() => deleteTeamAction(team.id));
          }}
        >
          Delete
        </button>
      </header>
      {team.members.length === 0 ? (
        <p className="px-4 py-5 text-bark/50">{droppable ? "Tap to add here" : "Empty"}</p>
      ) : (
        <ol className="divide-y divide-bark/10">
          {team.members.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 text-center font-bold text-bark/40">{i + 1}</span>
              <Chip
                active={selected === m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(selected === m.id ? null : m.id);
                }}
              >
                {m.nickname || m.name}
              </Chip>
              <span className="flex-1" />
              <OrderButton
                label="Move up"
                disabled={pending || i === 0}
                onClick={() => run(() => moveMemberAction(team.id, m.id, -1))}
              >
                ↑
              </OrderButton>
              <OrderButton
                label="Move down"
                disabled={pending || i === team.members.length - 1}
                onClick={() => run(() => moveMemberAction(team.id, m.id, 1))}
              >
                ↓
              </OrderButton>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold transition ${
        active ? "border-pumpkin bg-pumpkin text-white" : "border-bark/15 bg-white hover:border-bark/30"
      }`}
    >
      {children}
    </button>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="size-12 rounded-xl border-2 border-bark/10 text-xl disabled:opacity-25"
    >
      {children}
    </button>
  );
}
