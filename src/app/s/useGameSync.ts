"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Roll } from "@/lib/bowling";
import { saveRollsAction } from "./actions";

export type PendingGame = { roundId: number; personId: number; rolls: Roll[] };
export type SyncStatus = { pending: number; offline: boolean; error?: string };

const storageKey = (token: string) => `tb_outbox_${token}`;
const gameKey = (g: { roundId: number; personId: number }) => `${g.roundId}:${g.personId}`;

function load(token: string): Record<string, PendingGame> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(token)) ?? "{}");
  } catch {
    return {};
  }
}

function persist(token: string, pending: Record<string, PendingGame>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(storageKey(token), JSON.stringify(pending));
    else localStorage.removeItem(storageKey(token));
  } catch {
    // Private mode / storage full: D1 saves still work, we just lose the offline backup.
  }
}

/**
 * Saves each bowler's latest rolls to the server. Only the newest roll list per game
 * matters (saves are idempotent), so unsent changes collapse into one entry, are kept
 * in localStorage, and are retried until the server accepts them.
 */
export function useGameSync(token: string) {
  const pending = useRef<Record<string, PendingGame>>({});
  const inFlight = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, offline: false });

  const update = useCallback(
    (patch: Partial<SyncStatus> = {}) => {
      persist(token, pending.current);
      setStatus((s) => ({ ...s, ...patch, pending: Object.keys(pending.current).length }));
    },
    [token],
  );

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    clearTimeout(retry.current);
    try {
      let entry: PendingGame | undefined;
      while ((entry = Object.values(pending.current)[0])) {
        const key = gameKey(entry);
        let result;
        try {
          result = await saveRollsAction({ token, ...entry });
        } catch {
          update({ offline: true });
          retry.current = setTimeout(flush, 3000);
          return;
        }
        // Drop the entry unless a newer roll list arrived while this one was saving.
        if (pending.current[key] === entry) delete pending.current[key];
        update({ offline: false, error: result.ok ? undefined : result.error });
      }
    } finally {
      inFlight.current = false;
    }
  }, [token, update]);

  useEffect(() => {
    pending.current = { ...load(token), ...pending.current };
    update();
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(retry.current);
    };
  }, [token, flush, update]);

  const save = useCallback(
    (game: PendingGame) => {
      pending.current[gameKey(game)] = game;
      update();
      void flush();
    },
    [flush, update],
  );

  /** Unsent roll lists from a previous visit (newer than what the server has). */
  const unsent = useCallback((roundId: number) => Object.values(load(token)).filter((g) => g.roundId === roundId), [token]);

  return { save, status, unsent };
}
