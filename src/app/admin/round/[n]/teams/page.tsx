import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentEvent, getEventBowlers, getRound } from "@/server/events";
import { getRoundTeams } from "@/server/teams";
import { TeamBuilder } from "./TeamBuilder";

export default async function RoundTeamsPage({ params }: { params: Promise<{ n: string }> }) {
  const roundNumber = Number((await params).n);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) notFound();

  const db = getDb();
  const event = await getCurrentEvent(db);
  if (!event) redirect("/admin");
  const round = await getRound(db, event.id, roundNumber);
  if (!round) notFound();

  const [teams, bowlers] = await Promise.all([getRoundTeams(db, round.id), getEventBowlers(db, event.id)]);
  const onTeam = new Set(teams.flatMap((t) => t.members.map((m) => m.id)));
  const unassigned = bowlers.filter((b) => !onTeam.has(b.id));

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Round {roundNumber} teams</h1>
        <p className="text-bark/60">
          Tap a bowler, then tap a team to put them there. Use ↑ ↓ to set the bowling order.
        </p>
      </div>
      <TeamBuilder roundNumber={roundNumber} teams={teams} unassigned={unassigned} bowlerCount={bowlers.length} />
    </>
  );
}
