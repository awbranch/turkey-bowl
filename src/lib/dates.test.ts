import { describe, expect, it } from "vitest";
import { ageOn, dayAfterThanksgiving, isIsoDate } from "./dates";

describe("dayAfterThanksgiving", () => {
  it.each([
    [2023, "2023-11-24"],
    [2024, "2024-11-29"],
    [2025, "2025-11-28"],
    [2026, "2026-11-27"],
    [2027, "2027-11-26"],
  ])("%i → %s", (year, expected) => {
    expect(dayAfterThanksgiving(year)).toBe(expected);
  });
});

describe("isIsoDate", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-11-27")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("11/27/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("ageOn", () => {
  it("counts whole years, birthday inclusive", () => {
    expect(ageOn("2018-11-27", "2026-11-27")).toBe(8);
    expect(ageOn("2018-11-28", "2026-11-27")).toBe(7);
    expect(ageOn("1950-01-15", "2026-11-27")).toBe(76);
    expect(ageOn("1960-12-01", "2026-11-27")).toBe(65);
  });
});
