import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getTeamScoring } from "@/server/scoring";
import { TeamScorer } from "../../../TeamScorer";

export default async function TeamScoringPage({ params }: { params: Promise<{ token: string; teamId: string }> }) {
  const { token, teamId } = await params;
  const data = await getTeamScoring(await getDb(), token, Number(teamId));
  if (!data) notFound();
  const { round, team, bowlers } = data;

  if (round.status !== "bowling") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-5xl">🎳</p>
        <h1 className="text-2xl font-bold">
          Round {round.number} {round.status === "done" ? "is finished" : "hasn't started"}
        </h1>
        <Link href={`/s/${token}`} className="text-lg font-semibold text-cranberry underline">
          Back to teams
        </Link>
      </main>
    );
  }

  return (
    <TeamScorer
      // Remount when the server data changes identity (e.g. team edits), keeping local state otherwise.
      key={`${round.id}:${team.id}:${bowlers.map((b) => b.id).join(",")}`}
      token={token}
      roundId={round.id}
      roundNumber={round.number}
      team={{ id: team.id, name: team.name, color: team.color }}
      bowlers={bowlers}
    />
  );
}
