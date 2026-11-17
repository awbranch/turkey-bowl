"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** "Keep scoring <team>" shortcut, from the team this phone last scored in this round. */
export function ContinueLink({ token, roundId, teamIds }: { token: string; roundId: number; teamIds: number[] }) {
  const [last, setLast] = useState<{ teamId: number; name: string } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`tb_team_${token}`) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.roundId === roundId && teamIds.includes(saved.teamId)) setLast(saved);
    } catch {}
  }, [token, roundId, teamIds]);
  if (!last) return null;
  return (
    <Link
      href={`/s/${token}/team/${last.teamId}`}
      className="flex min-h-16 items-center justify-center rounded-2xl bg-cranberry px-5 text-xl font-bold text-white shadow"
    >
      Keep scoring {last.name} →
    </Link>
  );
}
