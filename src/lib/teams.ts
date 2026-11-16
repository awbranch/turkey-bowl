/** Default team names and colors, handed out in order. */
export const TEAM_PRESETS = [
  { name: "Drumsticks", color: "#b45309" },
  { name: "Gravy Boats", color: "#78350f" },
  { name: "Cranberries", color: "#9f1d35" },
  { name: "Stuffing", color: "#a16207" },
  { name: "Pumpkin Pies", color: "#e07a1f" },
  { name: "Sweet Potatoes", color: "#c2410c" },
  { name: "Green Beans", color: "#4d7c0f" },
  { name: "Dinner Rolls", color: "#ca8a04" },
] as const;

/** First preset whose name isn't taken (falls back to "Team N"). */
export function nextTeamPreset(existingNames: string[]): { name: string; color: string } {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const preset = TEAM_PRESETS.find((p) => !taken.has(p.name.toLowerCase()));
  if (preset) return { ...preset };
  let n = existingNames.length + 1;
  while (taken.has(`team ${n}`)) n++;
  return { name: `Team ${n}`, color: "#57534e" };
}

/** Suggested number of teams for a head count (teams of ~4, at least 1). */
export function suggestedTeamCount(bowlers: number, perTeam = 4): number {
  return Math.max(1, Math.round(bowlers / perTeam));
}

/**
 * Randomly deal people into `teamCount` teams as evenly as possible.
 * Returns one array of ids per team, in bowling order.
 */
export function dealTeams<T>(people: readonly T[], teamCount: number, random: () => number = Math.random): T[][] {
  const shuffled = [...people];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const teams: T[][] = Array.from({ length: Math.max(1, teamCount) }, () => []);
  shuffled.forEach((p, i) => teams[i % teams.length]!.push(p));
  return teams;
}
