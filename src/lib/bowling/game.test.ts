import { describe, expect, it } from "vitest";
import {
  allowedNextRolls,
  analyzeGame,
  findRollError,
  gameStreaks,
  InvalidRollError,
  scoreGame,
  validateRolls,
  type Roll,
} from "./game";

const r = (s: string) => s.split(" ").filter(Boolean) as Roll[];
const repeat = (s: string, n: number) => Array.from({ length: n }, () => s).join(" ");

describe("scoreGame", () => {
  it.each([
    ["perfect game", repeat("X", 12), 300],
    ["all gutters", repeat("G G", 10), 0],
    ["all misses", repeat("- -", 10), 0],
    ["all 9-spares", `${repeat("9 /", 10)} 9`, 190],
    ["all 5-spares", `${repeat("5 /", 10)} 5`, 150],
    ["all 9s, no spares", repeat("9 -", 10), 90],
    ["classic example game", "X 7 / 9 - X - 8 8 / - 6 X X X 8 1", 167],
    ["gutter then spare", `G / ${repeat("- -", 9)}`, 10],
    ["11 strikes then a 9", `${repeat("X", 11)} 9`, 299],
    ["9 strikes then 10th open", `${repeat("X", 9)} 7 2`, 265],
    ["10th: spare then strike", `${repeat("- -", 9)} 7 / X`, 20],
    ["10th: strike, then 7 and spare", `${repeat("- -", 9)} X 7 /`, 20],
    ["10th: strike, then open", `${repeat("- -", 9)} X 7 2`, 19],
  ])("%s", (_name, rolls, expected) => {
    const game = analyzeGame(r(rolls));
    expect(game.isComplete).toBe(true);
    expect(game.score).toBe(expected);
    expect(game.frames).toHaveLength(10);
    expect(game.frames[9]!.cumulative).toBe(expected);
  });

  it("returns cumulative totals per frame", () => {
    const game = analyzeGame(r("X 7 / 9 - X - 8 8 / - 6 X X X 8 1"));
    expect(game.frames.map((f) => f.cumulative)).toEqual([20, 39, 48, 66, 74, 84, 90, 120, 148, 167]);
  });

  it("scoreGame is a shortcut for the total", () => {
    expect(scoreGame(r(repeat("X", 12)))).toBe(300);
  });
});

describe("partial games", () => {
  it("an empty game", () => {
    const game = analyzeGame([]);
    expect(game).toMatchObject({ score: 0, isComplete: false, currentFrame: 1, frames: [] });
  });

  it("a strike waits for its two bonus balls", () => {
    let game = analyzeGame(r("X"));
    expect(game.frames[0]!.score).toBeNull();
    expect(game.score).toBe(0);

    game = analyzeGame(r("X 7"));
    expect(game.frames[0]!.score).toBeNull();
    expect(game.currentFrame).toBe(2);

    game = analyzeGame(r("X 7 2"));
    expect(game.frames.map((f) => f.cumulative)).toEqual([19, 28]);
    expect(game.score).toBe(28);
  });

  it("a spare waits for one bonus ball", () => {
    expect(analyzeGame(r("7 /")).frames[0]!.score).toBeNull();
    expect(analyzeGame(r("7 / 4")).frames[0]!.cumulative).toBe(14);
  });

  it("later known frames don't get a running total until earlier ones resolve", () => {
    // Frame 1 strike is pending (only one bonus ball so far), frame 2 is an incomplete open frame.
    const game = analyzeGame(r("X 3"));
    expect(game.frames.map((f) => f.cumulative)).toEqual([null, null]);
  });

  it("the score is the highest known running total", () => {
    expect(analyzeGame(r("9 - 8 1 X")).score).toBe(18);
  });

  it("tracks the current frame", () => {
    expect(analyzeGame(r("9")).currentFrame).toBe(1);
    expect(analyzeGame(r("9 -")).currentFrame).toBe(2);
    expect(analyzeGame(r(repeat("X", 9))).currentFrame).toBe(10);
    expect(analyzeGame(r(repeat("X", 12))).currentFrame).toBeNull();
  });
});

describe("validation", () => {
  it.each([
    ["spare on a first ball", "/", 0],
    ["strike on a second ball", "5 X", 1],
    ["strike on a second ball after a gutter", "G X", 1],
    ["two balls totalling 10 must be a spare", "5 5", 1],
    ["two balls totalling more than 10", "6 7", 1],
    ["unknown token", "A", 0],
    ["roll after a complete game", `${repeat("X", 12)} 5`, 12],
    ["third ball in an open 10th", `${repeat("- -", 9)} 7 2 5`, 20],
    ["10th: strike after X then 7", `${repeat("- -", 9)} X 7 X`, 20],
    ["10th: two balls over 10 after X", `${repeat("- -", 9)} X 7 5`, 20],
    ["spare after a strike", "X /", 1],
  ])("rejects %s", (_name, rolls, index) => {
    const err = findRollError(r(rolls));
    expect(err).toBeInstanceOf(InvalidRollError);
    expect(err!.index).toBe(index);
    expect(() => validateRolls(r(rolls))).toThrow(InvalidRollError);
    expect(() => analyzeGame(r(rolls))).toThrow(InvalidRollError);
  });

  it("accepts a legal partial game", () => {
    expect(findRollError(r("X 7 / G 9"))).toBeNull();
  });
});

describe("allowedNextRolls", () => {
  const FIRST = ["X", "G", "-", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  it("offers a full rack on the first ball", () => {
    expect(allowedNextRolls([])).toEqual(FIRST);
    expect(allowedNextRolls(r("X"))).toEqual(FIRST);
    expect(allowedNextRolls(r("7 2"))).toEqual(FIRST);
  });

  it("limits the second ball to the pins left standing", () => {
    expect(allowedNextRolls(r("7"))).toEqual(["/", "G", "-", "1", "2"]);
    expect(allowedNextRolls(r("9"))).toEqual(["/", "G", "-"]);
  });

  it("allows a spare (not a strike) after a zero first ball", () => {
    const allowed = allowedNextRolls(r("G"));
    expect(allowed).toContain("/");
    expect(allowed).not.toContain("X");
    expect(allowed).toContain("9");
  });

  it("resets the rack in the 10th after a strike or spare", () => {
    const nine = repeat("- -", 9);
    expect(allowedNextRolls(r(`${nine} X`))).toEqual(FIRST);
    expect(allowedNextRolls(r(`${nine} X X`))).toEqual(FIRST);
    expect(allowedNextRolls(r(`${nine} 6 /`))).toEqual(FIRST);
    expect(allowedNextRolls(r(`${nine} X 6`))).toEqual(["/", "G", "-", "1", "2", "3"]);
  });

  it("offers nothing once the game is complete", () => {
    expect(allowedNextRolls(r(`${repeat("- -", 9)} 7 2`))).toEqual([]);
    expect(allowedNextRolls(r(repeat("X", 12)))).toEqual([]);
  });
});

describe("gameStreaks", () => {
  it("perfect game", () => {
    expect(gameStreaks(r(repeat("X", 12)))).toEqual({ strikes: 12, spares: 0, gutters: 0 });
  });

  it("all gutters", () => {
    expect(gameStreaks(r(repeat("G G", 10)))).toEqual({ strikes: 0, spares: 0, gutters: 20 });
  });

  it("misses don't count as gutters", () => {
    expect(gameStreaks(r(repeat("- -", 10))).gutters).toBe(0);
    expect(gameStreaks(r("G - G G 5 G")).gutters).toBe(2);
  });

  it("gutters count on any ball and run across frames", () => {
    // frame 1: 5 G, frame 2: G G, frame 3: G 4 → G G G G
    expect(gameStreaks(r("5 G G G G 4")).gutters).toBe(4);
  });

  it("strike streaks are broken by any non-strike frame", () => {
    expect(gameStreaks(r("X X 7 / X X X 9 -")).strikes).toBe(3);
  });

  it("strike streaks run into the 10th frame bonus balls", () => {
    expect(gameStreaks(r(`${repeat("- -", 8)} X X X 7`)).strikes).toBe(3);
  });

  it("spare streaks count consecutive spare frames", () => {
    expect(gameStreaks(r("7 / 8 / X 9 / 1 / 2 / 3 4")).spares).toBe(3);
    expect(gameStreaks(r(`${repeat("9 /", 10)} 9`)).spares).toBe(10);
  });

  it("a 10th frame with a spare counts as a spare frame", () => {
    expect(gameStreaks(r(`${repeat("- -", 8)} 5 4 X 5 /`)).spares).toBe(1);
    expect(gameStreaks(r(`${repeat("- -", 8)} 5 / X 5 /`)).spares).toBe(2);
    expect(gameStreaks(r(`${repeat("- -", 8)} 5 / 5 / X`)).spares).toBe(2);
  });

  it("works on partial games", () => {
    expect(gameStreaks(r("X X G"))).toEqual({ strikes: 2, spares: 0, gutters: 1 });
  });
});
