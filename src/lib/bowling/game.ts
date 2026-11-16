/**
 * Ten-pin bowling: roll notation, validation, frame building, scoring and streaks.
 *
 * Roll tokens (see SPEC.md §6):
 *   X  strike            /  spare (remainder of the rack)
 *   G  gutter ball (0)   -  miss, not a gutter (0)
 *   1–9 pins knocked down
 *
 * Everything here is pure and derived from the `rolls` array, which is the
 * only thing stored in the database.
 */

export const ROLL_TOKENS = ["X", "/", "G", "-", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export type Roll = (typeof ROLL_TOKENS)[number];

/** Max rolls in a game: 9 frames × 2 + 3 in the 10th. */
export const MAX_ROLLS = 21;

const DIGITS: Roll[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
/** Allowed on the first ball at a full rack. */
const FIRST_BALL: readonly Roll[] = ["X", "G", "-", ...DIGITS];

/** Allowed on the ball after a non-strike first ball, with `standing` pins left. */
function secondBall(standing: number): Roll[] {
  return ["/", "G", "-", ...DIGITS.slice(0, standing - 1)];
}

export function isRoll(value: unknown): value is Roll {
  return typeof value === "string" && (ROLL_TOKENS as readonly string[]).includes(value);
}

export interface Frame {
  /** 1–10 */
  number: number;
  rolls: Roll[];
  /** Pins knocked down by each roll in this frame. */
  pins: number[];
  isStrike: boolean;
  /** Frames 1–9: second ball is `/`. 10th: any `/` in the frame. */
  isSpare: boolean;
  /** All balls for this frame have been thrown. */
  isComplete: boolean;
  /** This frame's points including bonus, or null if not yet known. */
  score: number | null;
  /** Running total through this frame, or null if not yet known. */
  cumulative: number | null;
}

export interface GameState {
  rolls: Roll[];
  frames: Frame[];
  /** Highest known running total (the final score once complete). */
  score: number;
  /** All 10 frames thrown. */
  isComplete: boolean;
  /** Tokens the keypad may offer for the next roll; empty once complete. */
  allowedNext: Roll[];
  /** Frame (1–10) the next roll belongs to, or null once complete. */
  currentFrame: number | null;
}

export class InvalidRollError extends Error {
  constructor(
    readonly index: number,
    readonly roll: string,
    message: string,
  ) {
    super(message);
    this.name = "InvalidRollError";
  }
}

interface Cursor {
  /** 0-based frame index; 10 = game over. */
  frame: number;
  /** Ball number within the frame. */
  ball: number;
  /** Pins standing before the next ball. */
  standing: number;
  /** Next ball is the first ball at a freshly set rack. */
  freshRack: boolean;
}

function allowedAt(c: Cursor): Roll[] {
  if (c.frame >= 10) return [];
  return c.freshRack ? [...FIRST_BALL] : secondBall(c.standing);
}

function pinsFor(roll: Roll, standing: number): number {
  if (roll === "X") return 10;
  if (roll === "/") return standing;
  if (roll === "G" || roll === "-") return 0;
  return Number(roll);
}

/**
 * Walk the rolls frame by frame, validating each one.
 * Throws InvalidRollError at the first illegal roll.
 */
function walk(rolls: readonly string[]): { frames: Omit<Frame, "score" | "cumulative">[]; cursor: Cursor } {
  const frames: Omit<Frame, "score" | "cumulative">[] = [];
  const c: Cursor = { frame: 0, ball: 0, standing: 10, freshRack: true };

  rolls.forEach((raw, i) => {
    if (c.frame >= 10) throw new InvalidRollError(i, raw, `Roll ${i + 1}: the game is already complete`);
    if (!isRoll(raw)) throw new InvalidRollError(i, raw, `Roll ${i + 1}: "${raw}" is not a valid roll`);
    const allowed = allowedAt(c);
    if (!allowed.includes(raw)) {
      throw new InvalidRollError(i, raw, `Roll ${i + 1}: "${raw}" is not possible in frame ${c.frame + 1}, ball ${c.ball + 1}`);
    }

    let frame = frames[c.frame];
    if (!frame) {
      frame = { number: c.frame + 1, rolls: [], pins: [], isStrike: false, isSpare: false, isComplete: false };
      frames.push(frame);
    }
    const pins = pinsFor(raw, c.standing);
    frame.rolls.push(raw);
    frame.pins.push(pins);
    if (raw === "X" && c.ball === 0) frame.isStrike = true;
    if (raw === "/") frame.isSpare = true;
    c.standing -= pins;

    const tenth = c.frame === 9;
    let frameDone: boolean;
    if (!tenth) {
      frameDone = raw === "X" || c.ball === 1;
    } else if (c.ball === 0) {
      frameDone = false;
    } else if (c.ball === 1) {
      // Third ball only after a strike or spare in the 10th.
      frameDone = !(frame.rolls[0] === "X" || raw === "/");
    } else {
      frameDone = true;
    }

    if (frameDone) {
      frame.isComplete = true;
      c.frame += 1;
      c.ball = 0;
      c.standing = 10;
      c.freshRack = true;
    } else {
      c.ball += 1;
      if (c.standing === 0) {
        // Rack reset in the 10th after a strike or spare.
        c.standing = 10;
        c.freshRack = true;
      } else {
        c.freshRack = false;
      }
    }
  });

  return { frames, cursor: c };
}

/** Throws InvalidRollError if the sequence is not a legal (possibly partial) game. */
export function validateRolls(rolls: readonly string[]): asserts rolls is Roll[] {
  walk(rolls);
}

/** Returns the first problem with the rolls, or null if they're a legal (possibly partial) game. */
export function findRollError(rolls: readonly string[]): InvalidRollError | null {
  try {
    walk(rolls);
    return null;
  } catch (err) {
    if (err instanceof InvalidRollError) return err;
    throw err;
  }
}

/** Full derived state of a game. Throws InvalidRollError on illegal rolls. */
export function analyzeGame(rolls: readonly string[]): GameState {
  const { frames: raw, cursor } = walk(rolls);
  const valid = rolls as readonly Roll[];
  const allPins = raw.flatMap((f) => f.pins);

  let start = 0;
  let running = 0;
  let known = true;
  const frames: Frame[] = raw.map((f) => {
    let score: number | null = null;
    if (f.number === 10) {
      score = f.isComplete ? sum(f.pins) : null;
    } else if (f.isStrike) {
      score = bonus(allPins, start + 1, 2);
    } else if (f.isSpare) {
      score = bonus(allPins, start + 2, 1);
    } else if (f.isComplete) {
      score = sum(f.pins);
    }
    start += f.pins.length;

    // A frame only gets a running total once every earlier frame has one.
    if (score === null) known = false;
    let cumulative: number | null = null;
    if (known && score !== null) {
      running += score;
      cumulative = running;
    }
    return { ...f, score, cumulative };
  });

  const isComplete = cursor.frame >= 10;
  return {
    rolls: [...valid],
    frames,
    score: running,
    isComplete,
    allowedNext: allowedAt(cursor),
    currentFrame: isComplete ? null : cursor.frame + 1,
  };

  function bonus(pins: number[], from: number, count: number): number | null {
    const next = pins.slice(from, from + count);
    return next.length === count ? 10 + sum(next) : null;
  }
}

export function scoreGame(rolls: readonly string[]): number {
  return analyzeGame(rolls).score;
}

export function allowedNextRolls(rolls: readonly string[]): Roll[] {
  return analyzeGame(rolls).allowedNext;
}

export interface Streaks {
  /** Longest run of consecutive strikes (max 12). */
  strikes: number;
  /** Longest run of consecutive frames that are spares. */
  spares: number;
  /** Longest run of consecutive gutter balls (`G`). */
  gutters: number;
}

/** Longest streaks within a single game. Throws InvalidRollError on illegal rolls. */
export function gameStreaks(rolls: readonly string[]): Streaks {
  const { frames } = walk(rolls);
  const valid = rolls as readonly Roll[];
  return {
    strikes: longestRun(valid, (r) => r === "X"),
    spares: longestRun(frames, (f) => f.isSpare),
    gutters: longestRun(valid, (r) => r === "G"),
  };
}

function longestRun<T>(items: readonly T[], match: (item: T) => boolean): number {
  let best = 0;
  let run = 0;
  for (const item of items) {
    run = match(item) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
