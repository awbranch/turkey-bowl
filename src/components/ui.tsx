import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
const variants: Record<Variant, string> = {
  primary: "bg-cranberry text-white hover:bg-cranberry/90",
  secondary: "border-2 border-bark/15 bg-white text-bark hover:border-bark/30",
  danger: "border-2 border-cranberry/30 bg-white text-cranberry hover:bg-cranberry/5",
  ghost: "text-bark/70 hover:bg-bark/5",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-bark/15 bg-white px-4 text-lg outline-none focus:border-pumpkin";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-bark/70">{label}</span>
      {children}
      {hint && <span className="text-sm text-bark/50">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-bark/10 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-cranberry/10 px-3 py-2 text-cranberry">{children}</p>;
}
