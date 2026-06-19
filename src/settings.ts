import type { Game } from './game';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  volume: number;
  sfx: boolean;
  music: boolean;
  quality: Quality;
}

const KEY = 'poke-royale-settings';
const DEFAULT: Settings = { volume: 0.8, sfx: true, music: true, quality: 'high' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* unavailable */ }
  return { ...DEFAULT };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/** Push the current settings into the live game (audio + renderer). */
export function applySettings(game: Game, s: Settings) {
  game.audio.setVolume(s.volume);
  game.audio.setSfxEnabled(s.sfx);
  game.audio.setMusicEnabled(s.music);
  game.setQuality(s.quality);
}
