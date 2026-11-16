import { describe, expect, it } from "vitest";
import { dealTeams, nextTeamPreset, suggestedTeamCount, TEAM_PRESETS } from "./teams";

describe("nextTeamPreset", () => {
  it("hands out presets in order, skipping taken names", () => {
    expect(nextTeamPreset([]).name).toBe(TEAM_PRESETS[0].name);
    expect(nextTeamPreset(["drumsticks"]).name).toBe(TEAM_PRESETS[1].name);
  });

  it("falls back to Team N", () => {
    const all = TEAM_PRESETS.map((p) => p.name);
    expect(nextTeamPreset(all).name).toBe(`Team ${all.length + 1}`);
  });
});

describe("suggestedTeamCount", () => {
  it.each([
    [0, 1],
    [3, 1],
    [12, 3],
    [14, 4],
    [16, 4],
  ])("%i bowlers → %i teams", (n, expected) => {
    expect(suggestedTeamCount(n)).toBe(expected);
  });
});

describe("dealTeams", () => {
  const people = Array.from({ length: 14 }, (_, i) => i + 1);

  it("puts everyone on exactly one team, sizes within one", () => {
    const teams = dealTeams(people, 4);
    expect(teams).toHaveLength(4);
    expect(teams.flat().sort((a, b) => a - b)).toEqual(people);
    const sizes = teams.map((t) => t.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("is driven by the random source", () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const a = dealTeams(people, 3, rng);
    seed = 1;
    const b = dealTeams(people, 3, rng);
    expect(a).toEqual(b);
  });

  it("handles a team count of zero as one team", () => {
    expect(dealTeams([1, 2], 0)).toEqual([expect.arrayContaining([1, 2])]);
  });
});
