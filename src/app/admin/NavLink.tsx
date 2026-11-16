"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 font-semibold ${active ? "bg-cranberry text-white" : "text-bark/70 hover:bg-bark/5"}`}
    >
      {children}
    </Link>
  );
}
