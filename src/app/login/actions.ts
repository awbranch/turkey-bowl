"use server";

import { redirect } from "next/navigation";
import { logIn } from "@/server/auth";

export async function loginAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const ok = await logIn(String(formData.get("passcode") ?? ""));
  if (!ok) return { error: "That's not the passcode." };
  redirect("/admin");
}
