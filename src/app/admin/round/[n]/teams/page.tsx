import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { QrCode } from "@/components/QrCode";
import { Card } from "@/components/ui";
import { getDb } from "@/db";
import { analyzeGame } from "@/lib/bowling";
import { getCurrentEvent, getEventBowlers, getRound, getRoundProgress } from "@/server/events";
import { requestOrigin } from "@/server/origin";
import { getRoundTeams } from "@/server/teams";
import { RoundControls } from "./RoundControls";
import { TeamBuilder } from "./TeamBuilder";

const STATUS_LABEL = { setup: "Setting up", bowling: "Bowling now", done: "Finished" } as const;

export default async function RoundTeamsPage({ params }: { params: Promise<{ n: string }> }) {
  const roundNumber = Number((await params).n);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) notFound();

  const db = await getDb();
  const event = await getCurrentEvent(db);
  if (!event) redirect("/admin");
  const round = await getRound(db, event.id, roundNumber);
  if (!round) notFound();

  const [teams, bowlers, progress] = await Promise.all([
    getRoundTeams(db, round.id),
    getEventBowlers(db, event.id),
    getRoundProgress(db, round.id),
  ]);
  const onTeam = new Set(teams.flatMap((t) => t.members.map((m) => m.id)));
  const unassigned = bowlers.filter((b) => !onTeam.has(b.id));
  const scorerUrl = `${await requestOrigin()}/s/${event.scoreToken}`;
  const finished = progress.filter((p) => p.complete).length;

  return (
    <>
      {round.status === "bowling" && <AutoRefresh seconds={5} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Round {roundNumber}</h1>
          <p className="text-lg text-bark/70">{STATUS_LABEL[round.status]}</p>
        </div>
        <RoundControls roundNumber={roundNumber} status={round.status} />
      </div>

      {round.status === "bowling" && (
        <Card title="Scorers: scan to enter scores">
          <div className="flex flex-wrap items-center gap-6">
            <QrCode value={scorerUrl} className="w-56 shrink-0 rounded-xl bg-white" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p>One person per team scans this, picks their team, and enters each roll as it happens.</p>
              <p className="break-all font-mono text-sm text-bark/60">{scorerUrl}</p>
            </div>
          </div>
        </Card>
      )}

      {round.status !== "setup" && progress.length > 0 && (
        <Card title={`Progress: ${finished} of ${progress.length} finished`}>
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((t) => (
              <div key={t.id}>
                <h3 className="mb-1 font-bold" style={{ color: t.color ?? undefined }}>
                  {t.name}
                </h3>
                <ul className="divide-y divide-bark/10">
                  {t.members.map((m) => {
                    const p = progress.find((x) => x.personId === m.id);
                    const frame = p && !p.complete ? analyzeGame(p.rolls).currentFrame : null;
                    return (
                      <li key={m.id} className="flex justify-between py-1.5">
                        <span>{m.nickname || m.name}</span>
                        <span className={p?.complete ? "font-bold text-green-700" : "text-bark/60"}>
                          {p?.complete ? `${p.score} ✓` : p?.rolls.length ? `Frame ${frame} · ${p.score}` : "Not started"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold">Teams</h2>
        <p className="text-bark/60">Tap a bowler, then tap a team to put them there. Use ↑ ↓ to set the bowling order.</p>
      </div>
      <TeamBuilder roundNumber={roundNumber} teams={teams} unassigned={unassigned} bowlerCount={bowlers.length} />
    </>
  );
}
