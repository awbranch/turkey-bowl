import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { events, games, rounds, teamMembers, teams } from "@/db/schema";
import { analyzeGame, findRollError, type Roll } from "@/lib/bowling";
import { getBowlingRound } from "./events";
import { getRoundTeams } from "./teams";

/** Event for a scorer link, if the link is still active. */
export async function getScorerEvent(db: Db, token: string) {
  const [event] = await db.select().from(events).where(eq(events.scoreToken, token)).limit(1);
  if (!event || event.status === "final") return undefined;
  return event;
}

export async function getScorerHome(db: Db, token: string) {
  const event = await getScorerEvent(db, token);
  if (!event) return undefined;
  const round = await getBowlingRound(db, event.id);
  const roundTeams = round ? await getRoundTeams(db, round.id) : [];
  return { event, round, teams: roundTeams };
}

/** A team's bowlers (in bowling order) with their current rolls for the team's round. */
export async function getTeamScoring(db: Db, token: string, teamId: number) {
  const event = await getScorerEvent(db, token);
  if (!event) return undefined;
  const [row] = await db
    .select({ team: teams, round: rounds })
    .from(teams)
    .innerJoin(rounds, eq(teams.roundId, rounds.id))
    .where(and(eq(teams.id, teamId), eq(rounds.eventId, event.id)))
    .limit(1);
  if (!row) return undefined;
  const [team] = (await getRoundTeams(db, row.round.id)).filter((t) => t.id === teamId);
  const gameRows = await db.select().from(games).where(eq(games.roundId, row.round.id));
  const bowlers = (team?.members ?? []).map((m) => ({
    ...m,
    rolls: (gameRows.find((g) => g.personId === m.id)?.rolls ?? []) as Roll[],
  }));
  return { event, round: row.round, team: row.team, bowlers };
}

export type SaveResult = { ok: true; score: number; complete: boolean } | { ok: false; error: string };

/**
 * Save a bowler's full roll list for a round (idempotent; last write wins).
 * Scorers pass requireBowling: true (only an open round); admin edits may write to any round.
 */
export async function saveGame(
  db: Db,
  input: { eventId: number; roundId: number; personId: number; rolls: string[]; requireBowling: boolean },
): Promise<SaveResult> {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.id, input.roundId), eq(rounds.eventId, input.eventId)))
    .limit(1);
  if (!round) return { ok: false, error: "Round not found." };
  if (input.requireBowling && round.status !== "bowling") {
    return { ok: false, error: `Round ${round.number} isn't open for scoring.` };
  }
  const [member] = await db
    .select({ personId: teamMembers.personId })
    .from(teamMembers)
    .where(and(eq(teamMembers.roundId, round.id), eq(teamMembers.personId, input.personId)))
    .limit(1);
  if (!member) return { ok: false, error: "That bowler isn't on a team this round." };

  const problem = findRollError(input.rolls);
  if (problem) return { ok: false, error: problem.message };
  const game = analyzeGame(input.rolls);

  const values = {
    rolls: game.rolls,
    score: game.score,
    complete: game.isComplete,
    updatedAt: new Date(),
  };
  await db
    .insert(games)
    .values({ roundId: round.id, personId: input.personId, ...values })
    .onConflictDoUpdate({ target: [games.roundId, games.personId], set: values });
  return { ok: true, score: game.score, complete: game.isComplete };
}
