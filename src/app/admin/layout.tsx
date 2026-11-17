import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/server/auth";
import { getCurrentEvent, getRounds } from "@/server/events";
import { logoutAction } from "./actions";
import { NavLink } from "./NavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const db = await getDb();
  const event = await getCurrentEvent(db);
  const rounds = event ? await getRounds(db, event.id) : [];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-bark/10 bg-cream/95 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <Link href="/admin" className="text-cranberry mr-2 text-xl font-bold">
            🦃 {event?.name ?? "Turkey Bowl"}
          </Link>
          <NavLink href="/admin">Event</NavLink>
          <NavLink href="/admin/people">People</NavLink>
          {rounds.map((r) => (
            <NavLink key={r.id} href={`/admin/round/${r.number}/teams`}>
              Round {r.number}
            </NavLink>
          ))}
          <form action={logoutAction} className="ml-auto">
            <button className="rounded-lg px-3 py-2 text-bark/60 hover:bg-bark/5">Log out</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
