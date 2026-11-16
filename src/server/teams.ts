import { and, asc, eq, inArray, max } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "@/db";
import { people, rounds, teamMembers, teams } from "@/db/schema";
import { dealTeams, nextTeamPreset } from "@/lib/teams";
import { getEventBowlers, getRound } from "./events";

export type TeamWithMembers = {
  id: number;
  name: string;
  color: string | null;
  members: { id: number; name: string; nickname: string | null; position: number }[];
};

async function runBatch(db: Db, items: BatchItem<"sqlite">[]) {
  if (items.length) await db.batch(items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

export async function getRoundTeams(db: Db, roundId: number): Promise<TeamWithMembers[]> {
  const teamRows = await db.select().from(teams).where(eq(teams.roundId, roundId)).orderBy(asc(teams.id));
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      id: people.id,
      name: people.name,
      nickname: people.nickname,
      position: teamMembers.position,
    })
    .from(teamMembers)
    .innerJoin(people, eq(teamMembers.personId, people.id))
    .where(eq(teamMembers.roundId, roundId))
    .orderBy(asc(teamMembers.position), asc(people.name));
  return teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    members: memberRows.filter((m) => m.teamId === t.id).map(({ teamId: _, ...m }) => m),
  }));
}

export async function createTeam(db: Db, roundId: number) {
  const existing = await db.select({ name: teams.name }).from(teams).where(eq(teams.roundId, roundId));
  const preset = nextTeamPreset(existing.map((t) => t.name));
  const [row] = await db.insert(teams).values({ roundId, ...preset }).returning();
  return row!;
}

export async function renameTeam(db: Db, teamId: number, name: string) {
  await db.update(teams).set({ name }).where(eq(teams.id, teamId));
}

export async function deleteTeam(db: Db, teamId: number) {
  await db.delete(teams).where(eq(teams.id, teamId));
}

/** Put a bowler on a team (at the end of its order), or take them off any team when teamId is null. */
export async function assignMember(db: Db, roundId: number, personId: number, teamId: number | null) {
  const remove = db
    .delete(teamMembers)
    .where(and(eq(teamMembers.roundId, roundId), eq(teamMembers.personId, personId)));
  if (teamId === null) {
    await remove;
    return;
  }
  const [team] = await db.select({ roundId: teams.roundId }).from(teams).where(eq(teams.id, teamId));
  if (team?.roundId !== roundId) throw new Error("Team is not in this round");
  const [{ last } = { last: -1 }] = await db
    .select({ last: max(teamMembers.position) })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  await db.batch([remove, db.insert(teamMembers).values({ teamId, roundId, personId, position: (last ?? -1) + 1 })]);
}

/** Move a bowler up (-1) or down (+1) in their team's bowling order. */
export async function moveMember(db: Db, teamId: number, personId: number, direction: -1 | 1) {
  const members = await db
    .select({ personId: teamMembers.personId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.position));
  const order = members.map((m) => m.personId);
  const from = order.indexOf(personId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to]!, order[from]!];
  await runBatch(
    db,
    order.map((id, position) =>
      db.update(teamMembers).set({ position }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.personId, id))),
    ),
  );
}

async function replaceTeams(db: Db, roundId: number, next: { name: string; color: string | null; personIds: number[] }[]) {
  await db.delete(teams).where(eq(teams.roundId, roundId)); // cascades members
  for (const t of next) {
    const [row] = await db.insert(teams).values({ roundId, name: t.name, color: t.color }).returning({ id: teams.id });
    await runBatch(
      db,
      t.personIds.map((personId, position) =>
        db.insert(teamMembers).values({ teamId: row!.id, roundId, personId, position }),
      ),
    );
  }
}

/** Replace this round's teams with a copy of the previous round's (current bowlers only). */
export async function copyTeamsFromPrevious(db: Db, eventId: number, roundNumber: number): Promise<{ error?: string }> {
  const round = await getRound(db, eventId, roundNumber);
  const prev = await getRound(db, eventId, roundNumber - 1);
  if (!round || !prev) return { error: "There's no previous round to copy." };
  const prevTeams = await getRoundTeams(db, prev.id);
  if (!prevTeams.length) return { error: `Round ${prev.number} has no teams yet.` };
  const bowling = new Set((await getEventBowlers(db, eventId)).map((b) => b.id));
  await replaceTeams(
    db,
    round.id,
    prevTeams.map((t) => ({ name: t.name, color: t.color, personIds: t.members.map((m) => m.id).filter((id) => bowling.has(id)) })),
  );
  return {};
}

/** Randomly deal every bowler into `teamCount` teams, replacing this round's teams. Keeps existing team names. */
export async function shuffleTeams(db: Db, eventId: number, roundNumber: number, teamCount: number) {
  const round = await getRound(db, eventId, roundNumber);
  if (!round) return { error: "Round not found." };
  const existing = await getRoundTeams(db, round.id);
  const bowlers = (await getEventBowlers(db, eventId)).map((b) => b.id);
  const dealt = dealTeams(bowlers, teamCount);
  const names: { name: string; color: string | null }[] = [];
  dealt.forEach((_, i) => {
    const keep = existing[i];
    const preset = keep ?? nextTeamPreset(names.map((n) => n.name));
    names.push({ name: preset.name, color: preset.color });
  });
  await replaceTeams(
    db,
    round.id,
    dealt.map((personIds, i) => ({ ...names[i]!, personIds })),
  );
  return {};
}

export async function roundBelongsToEvent(db: Db, roundId: number, eventId: number) {
  const [row] = await db.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.id, roundId), eq(rounds.eventId, eventId)));
  return !!row;
}

export async function teamInRounds(db: Db, teamId: number, roundIds: number[]) {
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), inArray(teams.roundId, roundIds.length ? roundIds : [-1])));
  return !!row;
}
