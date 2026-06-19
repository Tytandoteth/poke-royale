/** Lightweight, localStorage-backed meta progression. */

const KEY = 'poke-royale-progress';
const MAX_KING_LEVEL = 14;
const XP_PER_LEVEL = 100;

export interface Progress {
  trophies: number;
  wins: number;
  losses: number;
  draws: number;
  xp: number;
}

const DEFAULT: Progress = { trophies: 0, wins: 0, losses: 0, draws: 0, xp: 0 };

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* corrupt or unavailable — fall back */ }
  return { ...DEFAULT };
}

export function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function kingLevel(p: Progress = load()): number {
  return Math.min(MAX_KING_LEVEL, 1 + Math.floor(p.xp / XP_PER_LEVEL));
}

/** Progress (0–1) toward the next king level, for the XP bar. */
export function levelProgress(p: Progress = load()): number {
  if (kingLevel(p) >= MAX_KING_LEVEL) return 1;
  return (p.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
}

/** Player towers gain +4% HP per king level above 1. */
export function towerHpMultiplier(): number {
  return 1 + (kingLevel() - 1) * 0.04;
}

export interface MatchOutcome {
  progress: Progress;
  trophyDelta: number;
  xpGain: number;
  leveledUp: boolean;
  newLevel: number;
}

export function recordResult(result: 'win' | 'lose' | 'draw'): MatchOutcome {
  const p = load();
  const beforeLevel = kingLevel(p);
  let trophyDelta = 0;
  let xpGain = 0;
  if (result === 'win') { trophyDelta = 30; xpGain = 40; p.wins++; }
  else if (result === 'lose') { trophyDelta = -20; xpGain = 12; p.losses++; }
  else { trophyDelta = 5; xpGain = 20; p.draws++; }
  p.trophies = Math.max(0, p.trophies + trophyDelta);
  p.xp += xpGain;
  save(p);
  const newLevel = kingLevel(p);
  return { progress: p, trophyDelta, xpGain, leveledUp: newLevel > beforeLevel, newLevel };
}
