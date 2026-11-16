import { describe, expect, it } from "vitest";
import { passcodeMatches, safeEqual, signSession, verifySession } from "./session";

const SECRET = "test-secret";

describe("sessions", () => {
  it("verifies a token it signed until it expires", async () => {
    const now = 1_000_000;
    const token = await signSession(SECRET, now + 5000);
    expect(await verifySession(SECRET, token, now)).toBe(true);
    expect(await verifySession(SECRET, token, now + 5000)).toBe(false);
  });

  it("rejects tampered, foreign and missing tokens", async () => {
    const token = await signSession(SECRET, Date.now() + 60_000);
    const [, sig] = token.split(".");
    expect(await verifySession(SECRET, `${Date.now() + 999_999}.${sig}`)).toBe(false);
    expect(await verifySession("other-secret", token)).toBe(false);
    expect(await verifySession(SECRET, undefined)).toBe(false);
    expect(await verifySession(SECRET, "garbage")).toBe(false);
  });

  it("checks passcodes", async () => {
    expect(await passcodeMatches(SECRET, "gobble", "gobble")).toBe(true);
    expect(await passcodeMatches(SECRET, "Gobble", "gobble")).toBe(false);
    expect(await passcodeMatches(SECRET, "", "")).toBe(false);
  });

  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
