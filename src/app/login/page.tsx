import { redirect } from "next/navigation";
import { isAdmin } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4">
      <p className="text-5xl" aria-hidden>
        🦃
      </p>
      <h1 className="text-cranberry text-3xl font-bold">Turkey Bowl Admin</h1>
      <LoginForm />
    </main>
  );
}
