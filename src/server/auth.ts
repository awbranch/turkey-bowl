import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passcodeMatches, signSession, verifySession } from "@/lib/session";

const COOKIE = "tb_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 4; // a few days covers setup through the ceremony

async function secrets() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.SESSION_SECRET || !env.ADMIN_PASSCODE) {
    throw new Error("ADMIN_PASSCODE and SESSION_SECRET must be set (.dev.vars locally, wrangler secrets in production)");
  }
  return { secret: env.SESSION_SECRET, passcode: env.ADMIN_PASSCODE };
}

export async function isAdmin(): Promise<boolean> {
  const { secret } = await secrets();
  const store = await cookies();
  return verifySession(secret, store.get(COOKIE)?.value);
}

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/login");
}

export async function logIn(submitted: string): Promise<boolean> {
  const { secret, passcode } = await secrets();
  if (!(await passcodeMatches(secret, submitted.trim(), passcode))) return false;
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const store = await cookies();
  store.set(COOKIE, await signSession(secret, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export async function logOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
