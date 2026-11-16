import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { games, people } from "@/db/schema";

export type Person = typeof people.$inferSelect;
export type PersonInput = { name: string; nickname: string | null; birthdate: string };

export function listPeople(db: Db) {
  return db.select().from(people).orderBy(asc(sql`lower(${people.name})`));
}

export async function createPerson(db: Db, input: PersonInput) {
  const [row] = await db.insert(people).values(input).returning();
  return row!;
}

export async function updatePerson(db: Db, id: number, input: PersonInput) {
  await db.update(people).set(input).where(eq(people.id, id));
}

/** Deletes a person unless they have bowled (games would cascade away). */
export async function deletePerson(db: Db, id: number): Promise<{ error?: string }> {
  const [bowled] = await db.select({ id: games.id }).from(games).where(eq(games.personId, id)).limit(1);
  if (bowled) return { error: "This person has bowled games and can't be deleted." };
  await db.delete(people).where(eq(people.id, id));
  return {};
}
