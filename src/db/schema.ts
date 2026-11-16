import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Roll } from "@/lib/bowling";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

/** Bowlers. Persist across years. */
export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nickname: text("nickname"),
  /** ISO date, YYYY-MM-DD */
  birthdate: text("birthdate").notNull(),
  createdAt: createdAt(),
});

export const EVENT_STATUSES = ["setup", "live", "review", "final"] as const;

/** One tournament night (one per year). */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  name: text("name").notNull(),
  /** ISO date, YYYY-MM-DD */
  date: text("date").notNull(),
  status: text("status", { enum: EVENT_STATUSES }).notNull().default("setup"),
  scoreToken: text("score_token").notNull().unique(),
  mcToken: text("mc_token").notNull().unique(),
  /** Streak prizes with more tied winners than this are skipped (noted in MC wrap-up). */
  streakTieLimit: integer("streak_tie_limit").notNull().default(5),
  createdAt: createdAt(),
});

/** Who is bowling at an event. */
export const eventBowlers = sqliteTable(
  "event_bowlers",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.personId] })],
);

export const ROUND_STATUSES = ["setup", "bowling", "done"] as const;

/** One game per bowler. 2–3 per event. */
export const rounds = sqliteTable(
  "rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: text("status", { enum: ROUND_STATUSES }).notNull().default("setup"),
  },
  (t) => [uniqueIndex("rounds_event_number").on(t.eventId, t.number)],
);

/** Teams are per round so they can be reshuffled between rounds. */
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roundId: integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    /** Denormalized so a person can be on only one team per round. */
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Lane/bowling order within the team. */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.personId] }),
    uniqueIndex("team_members_round_person").on(t.roundId, t.personId),
  ],
);

/** A bowler's game in a round. `rolls` is the source of truth; score/complete are cached. */
export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    rolls: text("rolls", { mode: "json" }).$type<Roll[]>().notNull().default(sql`'[]'`),
    score: integer("score").notNull().default(0),
    complete: integer("complete", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("games_round_person").on(t.roundId, t.personId)],
);

export const AWARD_KINDS = ["individual", "team", "note"] as const;

/** The finalized ceremony script. Written at Finalize. */
export const awards = sqliteTable("awards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: AWARD_KINDS }).notNull(),
  prizeKey: text("prize_key").notNull(),
  title: text("title").notNull(),
  personId: integer("person_id").references(() => people.id, { onDelete: "set null" }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
  metric: integer("metric"),
  detail: text("detail").notNull().default(""),
  scriptLine: text("script_line").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  presentedAt: integer("presented_at", { mode: "timestamp" }),
  handedOut: integer("handed_out", { mode: "boolean" }).notNull().default(false),
});
