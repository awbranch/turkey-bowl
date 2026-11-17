"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { isIsoDate } from "@/lib/dates";
import { logOut, requireAdmin } from "@/server/auth";
import * as eventsDb from "@/server/events";
import * as peopleDb from "@/server/people";
import * as teamsDb from "@/server/teams";

export type ActionResult = { error?: string; ok?: boolean };

const isoDate = z.string().refine(isIsoDate, "Enter a valid date");
const id = z.coerce.number().int().positive();

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}

async function admin() {
  await requireAdmin();
  return getDb();
}

async function currentEvent() {
  const db = await admin();
  const event = await eventsDb.getCurrentEvent(db);
  if (!event) throw new Error("No event yet");
  return { db, event };
}

function done(result: ActionResult = {}): ActionResult {
  revalidatePath("/admin", "layout");
  return result.error ? result : { ok: true };
}

export async function logoutAction() {
  await logOut();
  redirect("/login");
}

// ---------- People ----------

const personSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Name is required").max(40),
  nickname: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null),
  birthdate: isoDate.refine((v) => v <= new Date().toISOString().slice(0, 10), "Birth date can't be in the future"),
});

export async function savePersonAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const db = await admin();
  const parsed = personSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    nickname: formData.get("nickname") ?? "",
    birthdate: formData.get("birthdate") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id: personId, ...input } = parsed.data;
  if (personId) {
    await peopleDb.updatePerson(db, personId, input);
  } else {
    const person = await peopleDb.createPerson(db, input);
    // New people are added to the current event's bowlers by default.
    const event = await eventsDb.getCurrentEvent(db);
    if (event && formData.get("addToEvent") === "on") await eventsDb.setBowling(db, event.id, person.id, true);
  }
  return done();
}

export async function deletePersonAction(personId: number): Promise<ActionResult> {
  const db = await admin();
  return done(await peopleDb.deletePerson(db, id.parse(personId)));
}

// ---------- Event ----------

const eventSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  date: isoDate,
});

export async function createEventAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const db = await admin();
  const parsed = eventSchema.safeParse({ name: formData.get("name"), date: formData.get("date") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  await eventsDb.createEvent(db, { ...parsed.data, year: Number(parsed.data.date.slice(0, 4)) });
  return done();
}

export async function updateEventAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  const parsed = eventSchema
    .extend({ streakTieLimit: z.coerce.number().int().min(1, "Tie limit must be at least 1").max(50) })
    .safeParse({ name: formData.get("name"), date: formData.get("date"), streakTieLimit: formData.get("streakTieLimit") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  await eventsDb.updateEvent(db, event.id, parsed.data);
  return done();
}

export async function setBowlingAction(personId: number, bowling: boolean): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  await eventsDb.setBowling(db, event.id, id.parse(personId), bowling);
  return done();
}

export async function addRoundAction(): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await eventsDb.addRound(db, event.id));
}

export async function removeLastRoundAction(): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await eventsDb.removeLastRound(db, event.id));
}

// ---------- Teams ----------

async function roundFor(roundNumber: number) {
  const { db, event } = await currentEvent();
  const round = await eventsDb.getRound(db, event.id, z.number().int().min(1).parse(roundNumber));
  if (!round) throw new Error("Round not found");
  return { db, event, round };
}

async function ownTeam(teamId: number) {
  const { db, event } = await currentEvent();
  const roundIds = (await eventsDb.getRounds(db, event.id)).map((r) => r.id);
  if (!(await teamsDb.teamInRounds(db, id.parse(teamId), roundIds))) throw new Error("Team not found");
  return { db, event };
}

export async function createTeamAction(roundNumber: number): Promise<ActionResult> {
  const { db, round } = await roundFor(roundNumber);
  await teamsDb.createTeam(db, round.id);
  return done();
}

export async function renameTeamAction(teamId: number, name: string): Promise<ActionResult> {
  const { db } = await ownTeam(teamId);
  const parsed = z.string().trim().min(1, "Team name is required").max(30).safeParse(name);
  if (!parsed.success) return { error: firstError(parsed.error) };
  await teamsDb.renameTeam(db, teamId, parsed.data);
  return done();
}

export async function deleteTeamAction(teamId: number): Promise<ActionResult> {
  const { db } = await ownTeam(teamId);
  await teamsDb.deleteTeam(db, teamId);
  return done();
}

export async function assignMemberAction(roundNumber: number, personId: number, teamId: number | null): Promise<ActionResult> {
  const { db, event, round } = await roundFor(roundNumber);
  const bowlers = await eventsDb.getEventBowlers(db, event.id);
  if (!bowlers.some((b) => b.id === personId)) return { error: "That person isn't bowling this year." };
  await teamsDb.assignMember(db, round.id, id.parse(personId), teamId === null ? null : id.parse(teamId));
  return done();
}

export async function moveMemberAction(teamId: number, personId: number, direction: -1 | 1): Promise<ActionResult> {
  const { db } = await ownTeam(teamId);
  await teamsDb.moveMember(db, teamId, id.parse(personId), direction === -1 ? -1 : 1);
  return done();
}

export async function copyTeamsAction(roundNumber: number): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await teamsDb.copyTeamsFromPrevious(db, event.id, roundNumber));
}

export async function shuffleTeamsAction(roundNumber: number, teamCount: number): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  const count = z.number().int().min(1).max(8).parse(teamCount);
  return done(await teamsDb.shuffleTeams(db, event.id, roundNumber, count));
}

// ---------- Round lifecycle ----------

export async function startRoundAction(roundNumber: number): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await eventsDb.startRound(db, event.id, roundNumber));
}

export async function finishRoundAction(roundNumber: number): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await eventsDb.finishRound(db, event.id, roundNumber));
}

export async function reopenRoundAction(roundNumber: number): Promise<ActionResult> {
  const { db, event } = await currentEvent();
  return done(await eventsDb.reopenRound(db, event.id, roundNumber));
}
