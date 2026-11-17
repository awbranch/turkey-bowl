import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getDb } from "@/db";
import { getScorerHome } from "@/server/scoring";
import { ContinueLink } from "../ContinueLink";

export default async function ScorerHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const home = await getScorerHome(await getDb(), token);

  if (!home) {
    return (
      <Centered>
        <p className="text-5xl">🦃</p>
        <h1 className="text-2xl font-bold">This scoring link isn&apos;t active</h1>
        <p className="text-bark/70">Ask for the QR code on the iPad.</p>
      </Centered>
    );
  }

  const { event, round, teams } = home;
  if (!round) {
    return (
      <Centered>
        <AutoRefresh seconds={5} />
        <p className="text-5xl">🎳</p>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-lg text-bark/70">Waiting for the next round to start…</p>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <AutoRefresh seconds={10} />
      <div className="text-center">
        <p className="text-bark/60">{event.name}</p>
        <h1 className="text-3xl font-bold">Round {round.number}</h1>
        <p className="mt-1 text-lg">Which team are you scoring?</p>
      </div>
      <ContinueLink token={token} roundId={round.id} teamIds={teams.map((t) => t.id)} />
      <ul className="flex flex-col gap-3">
        {teams.map((t) => (
          <li key={t.id}>
            <Link
              href={`/s/${token}/team/${t.id}`}
              className="flex flex-col gap-1 rounded-2xl border-l-8 bg-white p-4 shadow-sm active:scale-[0.99]"
              style={{ borderColor: t.color ?? "#57534e" }}
            >
              <span className="text-xl font-bold">{t.name}</span>
              <span className="text-bark/60">{t.members.map((m) => m.nickname || m.name).join(", ") || "No bowlers"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">{children}</main>;
}
