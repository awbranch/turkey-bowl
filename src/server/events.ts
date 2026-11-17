import { and, asc, desc, eq, inArray, max, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { eventBowlers, events, games, people, rounds, teamMembers, teams } from "@/db/schema";
import { randomToken } from "@/lib/tokens";

export type Event = typeof events.$inferSelect;
export type Round = typeof rounds.$inferSelect;

export const MAX_ROUNDS = 3;

/** The most recent event (one per year). */
export async function getCurrentEvent(db: Db): Promise<Event | undefined> {
  const [row] = await db.select().from(events).orderBy(desc(events.year), desc(events.id)).limit(1);
  return row;
}

export async function createEvent(db: Db, input: { year: number; name: string; date: string }) {
  const [row] = await db
    .insert(events)
    .values({ ...input, scoreToken: randomToken(), mcToken: randomToken() })
    .returning();
  // Every event starts with round 1.
  await db.insert(rounds).values({ eventId: row!.id, number: 1 });
  return row!;
}

export async function updateEvent(db: Db, id: number, input: { name: string; date: string; streakTieLimit: number }) {
  await db.update(events).set(input).where(eq(events.id, id));
}

export function getEventBowlers(db: Db, eventId: number) {
  return db
    .select({ id: people.id, name: people.name, nickname: people.nickname, birthdate: people.birthdate })
    .from(eventBowlers)
    .innerJoin(people, eq(eventBowlers.personId, people.id))
    .where(eq(eventBowlers.eventId, eventId))
    .orderBy(asc(sql`lower(${people.name})`));
}

export async function setBowling(db: Db, eventId: number, personId: number, bowling: boolean) {
  if (bowling) {
    await db.insert(eventBowlers).values({ eventId, personId }).onConflictDoNothing();
    return;
  }
  const roundIds = (await getRounds(db, eventId)).map((r) => r.id);
  await db.batch([
    db.delete(eventBowlers).where(and(eq(eventBowlers.eventId, eventId), eq(eventBowlers.personId, personId))),
    db
      .delete(teamMembers)
      .where(and(inArray(teamMembers.roundId, roundIds.length ? roundIds : [-1]), eq(teamMembers.personId, personId))),
  ]);
}

export function getRounds(db: Db, eventId: number) {
  return db.select().from(rounds).where(eq(rounds.eventId, eventId)).orderBy(asc(rounds.number));
}

export async function getRound(db: Db, eventId: number, number: number): Promise<Round | undefined> {
  const [row] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.eventId, eventId), eq(rounds.number, number)))
    .limit(1);
  return row;
}

export async function addRound(db: Db, eventId: number): Promise<{ error?: string }> {
  const [{ last } = { last: 0 }] = await db
    .select({ last: max(rounds.number) })
    .from(rounds)
    .where(eq(rounds.eventId, eventId));
  const next = (last ?? 0) + 1;
  if (next > MAX_ROUNDS) return { error: `An event can have at most ${MAX_ROUNDS} rounds.` };
  await db.insert(rounds).values({ eventId, number: next });
  return {};
}

/** Removes the last round, but only if nobody has bowled in it yet. */
export async function removeLastRound(db: Db, eventId: number): Promise<{ error?: string }> {
  const all = await getRounds(db, eventId);
  const last = all.at(-1);
  if (!last || all.length === 1) return { error: "An event needs at least one round." };
  const [started] = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.roundId, last.id), ne(games.rolls, sql`'[]'`)))
    .limit(1);
  if (started) return { error: `Round ${last.number} already has scores and can't be removed.` };
  await db.delete(rounds).where(eq(rounds.id, last.id));
  return {};
}

/** Team and member counts per round, for the event dashboard. */
export async function getRoundSummaries(db: Db, eventId: number) {
  const list = await getRounds(db, eventId);
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const teamCounts = await db
    .select({ roundId: teams.roundId, count: sql<number>`count(*)` })
    .from(teams)
    .where(inArray(teams.roundId, ids))
    .groupBy(teams.roundId);
  const memberCounts = await db
    .select({ roundId: teamMembers.roundId, count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(inArray(teamMembers.roundId, ids))
    .groupBy(teamMembers.roundId);
  return list.map((r) => ({
    ...r,
    teamCount: teamCounts.find((t) => t.roundId === r.id)?.count ?? 0,
    assignedCount: memberCounts.find((m) => m.roundId === r.id)?.count ?? 0,
  }));
}

// ---------- Round lifecycle ----------

/** Every bowler on a team in the round, with whether their game is complete and how far along it is. */
export async function getRoundProgress(db: Db, roundId: number) {
  const rows = await db
    .select({
      personId: teamMembers.personId,
      name: people.name,
      nickname: people.nickname,
      teamId: teamMembers.teamId,
      complete: games.complete,
      score: games.score,
      rolls: games.rolls,
    })
    .from(teamMembers)
    .innerJoin(people, eq(teamMembers.personId, people.id))
    .leftJoin(games, and(eq(games.roundId, teamMembers.roundId), eq(games.personId, teamMembers.personId)))
    .where(eq(teamMembers.roundId, roundId));
  return rows.map((r) => ({ ...r, complete: r.complete ?? false, score: r.score ?? 0, rolls: r.rolls ?? [] }));
}

export async function getBowlingRound(db: Db, eventId: number): Promise<Round | undefined> {
  const [row] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.eventId, eventId), eq(rounds.status, "bowling")))
    .orderBy(asc(rounds.number))
    .limit(1);
  return row;
}

/** Open a round for scoring. Only one round bowls at a time. */
export async function startRound(db: Db, eventId: number, number: number): Promise<{ error?: string }> {
  const round = await getRound(db, eventId, number);
  if (!round) return { error: "Round not found." };
  const bowling = await getBowlingRound(db, eventId);
  if (bowling && bowling.id !== round.id) return { error: `Finish round ${bowling.number} first.` };
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.roundId, round.id)).limit(1);
  if (!team) return { error: "Set up teams before starting the round." };
  await db.batch([
    db.update(rounds).set({ status: "bowling" }).where(eq(rounds.id, round.id)),
    db.update(events).set({ status: "live" }).where(and(eq(events.id, eventId), eq(events.status, "setup"))),
  ]);
  return {};
}

/** Close a round. Every bowler on a team must have a complete game. */
export async function finishRound(db: Db, eventId: number, number: number): Promise<{ error?: string }> {
  const round = await getRound(db, eventId, number);
  if (!round) return { error: "Round not found." };
  const unfinished = (await getRoundProgress(db, round.id)).filter((p) => !p.complete);
  if (unfinished.length) {
    const names = unfinished.map((p) => p.nickname || p.name).join(", ");
    return { error: `Still bowling: ${names}.` };
  }
  await db.update(rounds).set({ status: "done" }).where(eq(rounds.id, round.id));
  return {};
}

/** Reopen a finished round (e.g. to fix a score). */
export async function reopenRound(db: Db, eventId: number, number: number): Promise<{ error?: string }> {
  const round = await getRound(db, eventId, number);
  if (!round) return { error: "Round not found." };
  const bowling = await getBowlingRound(db, eventId);
  if (bowling && bowling.id !== round.id) return { error: `Finish round ${bowling.number} first.` };
  await db.update(rounds).set({ status: "bowling" }).where(eq(rounds.id, round.id));
  return {};
}
