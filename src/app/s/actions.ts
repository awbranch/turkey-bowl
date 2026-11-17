"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { MAX_ROLLS, ROLL_TOKENS } from "@/lib/bowling";
import { getScorerEvent, saveGame, type SaveResult } from "@/server/scoring";

const input = z.object({
  token: z.string().min(8).max(64),
  roundId: z.number().int().positive(),
  personId: z.number().int().positive(),
  rolls: z.array(z.enum(ROLL_TOKENS)).max(MAX_ROLLS),
});

/** Scorer phones call this after every tap with the bowler's full roll list. */
export async function saveRollsAction(raw: z.input<typeof input>): Promise<SaveResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid score data." };
  const { token, ...rest } = parsed.data;
  const db = await getDb();
  const event = await getScorerEvent(db, token);
  if (!event) return { ok: false, error: "This scoring link is no longer active." };
  return saveGame(db, { ...rest, eventId: event.id, requireBowling: true });
}
