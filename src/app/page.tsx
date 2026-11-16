import { ButtonLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-6xl" aria-hidden>
        🦃🎳
      </p>
      <h1 className="text-cranberry text-4xl font-bold">Turkey Bowl</h1>
      <p className="text-lg">The live board is coming soon.</p>
      <ButtonLink href="/admin" variant="secondary">
        Admin
      </ButtonLink>
    </main>
  );
}
