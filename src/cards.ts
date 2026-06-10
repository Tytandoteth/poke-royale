import type { UnitStats } from './types';

export const CARDS: Record<string, UnitStats> = {
  pikachu: {
    id: 'pikachu', name: 'Pikachu', emoji: '⚡', uiColor: '#d9a826',
    cost: 3, count: 1, hp: 340, dmg: 95, attackInterval: 1.1, range: 5,
    speed: 3.4, flying: false, targetsAir: true,
    radius: 0.4, height: 1.0, aggro: 7,
    projectile: { speed: 20, arc: 0.25, color: 0xffe94d, size: 0.12 },
  },
  charizard: {
    id: 'charizard', name: 'Charizard', emoji: '🔥', uiColor: '#d96a26',
    cost: 5, count: 1, hp: 950, dmg: 160, attackInterval: 1.6, range: 3.4,
    speed: 2.9, flying: true, targetsAir: true,
    radius: 0.55, height: 1.5, aggro: 7.5,
    projectile: { speed: 12, arc: 0.5, color: 0xff7a2d, size: 0.18, splash: 1.5 },
  },
  squirtle: {
    id: 'squirtle', name: 'Squirtle', emoji: '💧', uiColor: '#2f8fd4',
    cost: 2, count: 1, hp: 280, dmg: 62, attackInterval: 1.0, range: 4.5,
    speed: 3.0, flying: false, targetsAir: true,
    radius: 0.38, height: 0.9, aggro: 7,
    projectile: { speed: 15, arc: 0.45, color: 0x5db9ff, size: 0.13 },
  },
  bulbasaur: {
    id: 'bulbasaur', name: 'Bulbasaur', emoji: '🌿', uiColor: '#3aa069',
    cost: 3, count: 1, hp: 520, dmg: 82, attackInterval: 1.2, range: 4,
    speed: 2.7, flying: false, targetsAir: false,
    radius: 0.45, height: 0.95, aggro: 7,
    projectile: { speed: 14, arc: 0.4, color: 0x7ed957, size: 0.13 },
  },
  machamp: {
    id: 'machamp', name: 'Machamp', emoji: '👊', uiColor: '#5b6c9e',
    cost: 5, count: 1, hp: 1500, dmg: 210, attackInterval: 1.5, range: 1.3,
    speed: 2.5, flying: false, targetsAir: false,
    radius: 0.55, height: 1.7, aggro: 7,
  },
  golem: {
    id: 'golem', name: 'Golem', emoji: '🪨', uiColor: '#8a7355',
    cost: 6, count: 1, hp: 2700, dmg: 190, attackInterval: 1.8, range: 1.4,
    speed: 1.7, flying: false, targetsAir: false, buildingOnly: true,
    radius: 0.65, height: 1.6, aggro: 7,
  },
  gengar: {
    id: 'gengar', name: 'Gengar', emoji: '👻', uiColor: '#6d50b8',
    cost: 4, count: 1, hp: 750, dmg: 150, attackInterval: 1.1, range: 1.2,
    speed: 4.2, flying: false, targetsAir: false,
    radius: 0.45, height: 1.1, aggro: 7.5,
  },
  eevee: {
    id: 'eevee', name: 'Eevee Pack', emoji: '🦊', uiColor: '#a8743e',
    cost: 2, count: 3, hp: 140, dmg: 48, attackInterval: 0.9, range: 1.0,
    speed: 3.7, flying: false, targetsAir: false,
    radius: 0.3, height: 0.7, aggro: 6.5,
  },
  thunder: {
    id: 'thunder', name: 'Thunder', emoji: '🌩️', uiColor: '#7c5cd9',
    cost: 4, count: 0, hp: 0, dmg: 380, attackInterval: 0, range: 0,
    speed: 0, flying: false, targetsAir: true,
    radius: 0, height: 0, aggro: 0,
    spell: { radius: 2.6, towerDmgFactor: 0.35, kind: 'thunder' },
  },
  machoke: {
    id: 'machoke', name: 'Machoke', emoji: '🥊', uiColor: '#7a86b8',
    cost: 3, count: 1, hp: 650, dmg: 240, attackInterval: 1.6, range: 1.2,
    speed: 3.1, flying: false, targetsAir: false,
    radius: 0.45, height: 1.3, aggro: 7,
  },
  snorlax: {
    id: 'snorlax', name: 'Snorlax', emoji: '😴', uiColor: '#3f6e8c',
    cost: 4, count: 1, hp: 1700, dmg: 110, attackInterval: 1.3, range: 1.6,
    speed: 0, flying: false, targetsAir: false, building: true,
    radius: 0.8, height: 1.5, aggro: 7,
  },
  dragonite: {
    id: 'dragonite', name: 'Dragonite', emoji: '🐉', uiColor: '#e8a23c',
    cost: 5, count: 1, hp: 1150, dmg: 380, attackInterval: 2.0, range: 1.5,
    speed: 2.7, flying: true, targetsAir: false, buildingOnly: true,
    radius: 0.5, height: 1.4, aggro: 7,
  },
  zubat: {
    id: 'zubat', name: 'Zubat Trio', emoji: '🦇', uiColor: '#5a7ac4',
    cost: 3, count: 3, hp: 120, dmg: 42, attackInterval: 0.8, range: 1.0,
    speed: 3.9, flying: true, targetsAir: true,
    radius: 0.3, height: 0.6, aggro: 6.5,
  },
  fireblast: {
    id: 'fireblast', name: 'Fire Blast', emoji: '☄️', uiColor: '#d94f26',
    cost: 3, count: 0, hp: 0, dmg: 200, attackInterval: 0, range: 0,
    speed: 0, flying: false, targetsAir: true,
    radius: 0, height: 0, aggro: 0,
    spell: { radius: 2.0, towerDmgFactor: 0.3, kind: 'fire', knockback: true },
  },
  icebeam: {
    id: 'icebeam', name: 'Ice Beam', emoji: '❄️', uiColor: '#6fc6e8',
    cost: 4, count: 0, hp: 0, dmg: 100, attackInterval: 0, range: 0,
    speed: 0, flying: false, targetsAir: true,
    radius: 0, height: 0, aggro: 0,
    spell: { radius: 2.5, towerDmgFactor: 0.3, kind: 'freeze', freezeDur: 4 },
  },
};

export const ALL_CARD_IDS = Object.keys(CARDS);

/** Default 8-card deck for first launch. */
export const DECK_IDS = [
  'pikachu', 'charizard', 'squirtle', 'machamp',
  'golem', 'eevee', 'thunder', 'machoke',
];

export function randomDeck(): string[] {
  const ids = [...ALL_CARD_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // at most 2 spells so the AI always has a real army
  const spells = ids.filter((id) => CARDS[id].spell);
  const units = ids.filter((id) => !CARDS[id].spell);
  return [...units.slice(0, 6), ...spells.slice(0, 2)];
}

/** Card cycle: hand of 4 + queue, Clash Royale style. */
export class Deck {
  queue: UnitStats[];
  hand: UnitStats[];

  constructor(ids: string[], shuffle = false) {
    const list = ids.map((id) => CARDS[id]);
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    this.hand = list.slice(0, 4);
    this.queue = list.slice(4);
  }

  next(): UnitStats {
    return this.queue[0];
  }

  /** Play hand[i]: replace with next card, send played card to the back. */
  play(i: number): UnitStats {
    const card = this.hand[i];
    this.hand[i] = this.queue.shift()!;
    this.queue.push(card);
    return card;
  }
}
