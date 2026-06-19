import * as THREE from 'three';

/** Arena dimensions. Player owns z > 0, enemy owns z < 0. */
export const ARENA = {
  halfW: 9,
  halfL: 16,
  riverHalfW: 1.0,
  bridgeX: 5,
  bridgeHalfW: 1.5,
  princess: { x: 5, z: 9 },
  king: { z: 13.5 },
};

export const MATCH = {
  duration: 180,
  doubleElixirAt: 120,
  suddenDeathMax: 60,
  elixirRate: 1 / 2.8,
  maxElixir: 10,
  startElixir: 5,
};

export const FLY_HEIGHT = 2.6;

/** Rapier collision groups: (membership << 16) | filter */
export const GROUP = {
  GROUND: 0x0001,
  UNIT: 0x0002,
  FLY: 0x0004,
  TOWER: 0x0008,
  BLOCK: 0x0010,
};
export const groups = (mem: number, filter: number) => ((mem << 16) | filter);

export type ProjectileStyle = 'orb' | 'bolt' | 'bubble' | 'leaf' | 'fireball';

export interface ProjectileSpec {
  speed: number;
  arc: number;
  color: number;
  size: number;
  splash?: number;
  style?: ProjectileStyle;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type MeleeStyle = 'punch' | 'slam' | 'slash' | 'bite';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb0c8',
  rare: '#ffb02e',
  epic: '#c06bf0',
  legendary: '#38e0d0',
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export interface UnitStats {
  id: string;
  name: string;
  emoji: string;
  uiColor: string;
  cost: number;
  count: number;
  hp: number;
  dmg: number;
  attackInterval: number;
  range: number;
  speed: number;
  flying: boolean;
  targetsAir: boolean;
  buildingOnly?: boolean;
  radius: number;
  height: number;
  aggro: number;
  rarity: Rarity;
  /** One-line flavor describing what makes this card distinct. */
  trait: string;
  /** Melee attack flavor — drives the lunge animation + impact FX. */
  meleeStyle?: MeleeStyle;
  projectile?: ProjectileSpec;
  /** Present on spell cards: cast anywhere, instant area damage. */
  spell?: {
    radius: number;
    towerDmgFactor: number;
    kind: 'thunder' | 'fire' | 'freeze';
    freezeDur?: number;
    knockback?: boolean;
  };
  /** Stationary defensive structure: never moves, slowly decays, taunts building-seekers. */
  building?: boolean;
}

export interface Combatant {
  team: number;
  alive: boolean;
  flying: boolean;
  isBuilding: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  getPosition(out?: THREE.Vector3): THREE.Vector3;
  takeDamage(dmg: number, fromDir?: THREE.Vector3): void;
}

export const TEAM_COLOR = [0x3b82f6, 0xef4444];

export function distXZ(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
