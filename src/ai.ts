import * as THREE from 'three';
import { ARENA, MATCH } from './types';
import type { UnitStats } from './types';
import { Deck } from './cards';
import type { Game } from './game';
import type { Unit } from './unit';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface DiffCfg {
  thinkMin: number;
  thinkMax: number;
  /** chance to grab a random card instead of the correct counter */
  missChance: number;
  /** elixir required before starting an offensive push */
  pushThreshold: number;
  /** react to player units once they cross below this z line */
  defendLead: number;
  /** require real value before spending a spell */
  holdSpells: boolean;
  /** funnel pushes into a player tower that's already weak/dead */
  exploitLanes: boolean;
}

const DIFF: Record<Difficulty, DiffCfg> = {
  easy: { thinkMin: 1.7, thinkMax: 2.8, missChance: 0.45, pushThreshold: 10, defendLead: 0.2, holdSpells: false, exploitLanes: false },
  normal: { thinkMin: 1.0, thinkMax: 1.8, missChance: 0.18, pushThreshold: 9, defendLead: 1.0, holdSpells: true, exploitLanes: true },
  hard: { thinkMin: 0.6, thinkMax: 1.1, missChance: 0.0, pushThreshold: 7, defendLead: 2.0, holdSpells: true, exploitLanes: true },
};

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

/** Total DPS of a card's whole deployment (swarms count every body). */
const dpsOf = (c: UnitStats) => (c.attackInterval > 0 ? (c.dmg * Math.max(1, c.count)) / c.attackInterval : 0);
/** Total HP of a card's whole deployment. */
const hpOf = (c: UnitStats) => c.hp * Math.max(1, c.count);

interface HandCard { card: UnitStats; i: number; }
interface Threat { x: number; z: number; hp: number; dps: number; air: boolean; count: number; }
interface Cluster { x: number; z: number; hp: number; n: number; }

/**
 * Scored, archetype-aware AI: reads the most advanced player push, counter-picks
 * the right defender, spends spells on value, and builds lane pressure when rich.
 * Three difficulty tiers tune reaction speed, accuracy, and aggression.
 */
export class AiController {
  game: Game;
  deck: Deck;
  elixir = MATCH.startElixir;
  cfg: DiffCfg;
  thinkT = 2.5;
  private lane = 1; // last offensive lane sign

  constructor(game: Game, deckIds: string[], difficulty: Difficulty = 'normal') {
    this.game = game;
    this.deck = new Deck(deckIds, true);
    this.cfg = DIFF[difficulty];
  }

  update(dt: number, rate: number) {
    this.elixir = Math.min(MATCH.maxElixir, this.elixir + rate * dt);
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.cfg.thinkMin + Math.random() * (this.cfg.thinkMax - this.cfg.thinkMin);

    // 1. Defend the most advanced player push with a real counter.
    const push = this.readThreat();
    if (push && this.defend(push)) return;

    // 2. Spend a spell when there's value (or stall a push near our towers).
    if (this.trySpell()) return;

    // 3. Build an offensive push when rich enough.
    if (this.elixir >= this.cfg.pushThreshold && this.game.time > 6) {
      if (this.pushLane(false)) return;
    }

    // 4. Avoid elixir leak — dump the cheapest card into a lane.
    if (this.elixir >= MATCH.maxElixir - 0.4) this.pushLane(true);
  }

  /** Most advanced player unit past the defend line, plus its nearby support. */
  private readThreat(): Threat | null {
    const players = this.game.units.filter((u) => u.team === 0 && u.alive);
    let lead: Unit | null = null;
    let leadZ = Infinity;
    for (const u of players) {
      u.getPosition(_p);
      if (_p.z < this.cfg.defendLead && _p.z < leadZ) { leadZ = _p.z; lead = u; }
    }
    if (!lead) return null;
    lead.getPosition(_p);
    const cx0 = _p.x, cz0 = _p.z;
    let hp = 0, dps = 0, airHp = 0, count = 0, cx = 0;
    for (const u of players) {
      const q = u.getPosition(_q);
      if ((q.x - cx0) ** 2 + (q.z - cz0) ** 2 < 3.8 * 3.8) {
        hp += u.hp; dps += dpsOf(u.stats); count++; cx += q.x;
        if (u.flying) airHp += u.hp;
      }
    }
    return { x: cx / Math.max(1, count), z: cz0, hp, dps, air: airHp > hp * 0.5, count };
  }

  private defend(push: Threat): boolean {
    const affordable = this.affordableUnits();
    if (!affordable.length) return false;
    const pick = Math.random() < this.cfg.missChance
      ? affordable[(Math.random() * affordable.length) | 0]
      : this.bestCounter(push, affordable);
    if (!pick) return false;
    const z = THREE.MathUtils.clamp(push.z - 2.2, -ARENA.halfL + 1.2, -1.4);
    const x = THREE.MathUtils.clamp(push.x + (Math.random() - 0.5) * 1.2, -ARENA.halfW + 0.8, ARENA.halfW - 0.8);
    this.deploy(pick, new THREE.Vector3(x, 0, z));
    return true;
  }

  /** Pick the card that best answers this push's archetype. */
  private bestCounter(push: Threat, list: HandCard[]): HandCard | null {
    let best: HandCard | null = null;
    let bestScore = -Infinity;
    for (const entry of list) {
      const c = entry.card;
      let s = dpsOf(c) / 40 + hpOf(c) / 600;
      if (c.buildingOnly) s -= 6; // golem/dragonite ignore troops — terrible defenders
      if (push.air) s += c.targetsAir ? 5 : -8;
      if (push.count >= 3) {
        if (c.projectile?.splash) s += 5;
        else if (c.count >= 3) s += 1;
        else s -= 1.5;
      }
      if (push.hp >= 1200 && push.count <= 2) {
        if (c.count >= 3) s += 4; // swarm shreds a lone tank
        s += dpsOf(c) / 30;
      }
      if (s > bestScore) { bestScore = s; best = entry; }
    }
    return best;
  }

  private trySpell(): boolean {
    const entry = this.deck.hand
      .map((card, i) => ({ card, i }))
      .find(({ card }) => card.spell && card.cost <= this.elixir);
    if (!entry) return false;
    const spell = entry.card.spell!;
    const cluster = this.bestCluster();
    if (!cluster) return false;
    const isFreeze = spell.kind === 'freeze';
    if (cluster.n < 2 && !isFreeze) return false;
    const minValue = (this.cfg.holdSpells ? 180 : 90) * entry.card.cost;
    const stalling = isFreeze && cluster.z < -6; // freeze a push at our doorstep
    if (cluster.hp < minValue && !stalling) return false;
    this.elixir -= entry.card.cost;
    this.deck.play(entry.i);
    this.game.castSpell(1, entry.card, new THREE.Vector3(cluster.x, 0, cluster.z));
    return true;
  }

  /** Highest-HP cluster of player units within a spell radius. */
  private bestCluster(): Cluster | null {
    const players = this.game.units.filter((u) => u.team === 0 && u.alive);
    let best: Cluster | null = null;
    let bestHp = 0;
    const R = 2.4;
    for (const a of players) {
      const pa = a.getPosition(_p);
      const ax = pa.x, az = pa.z;
      let hp = 0, n = 0, cx = 0, cz = 0;
      for (const b of players) {
        const q = b.getPosition(_q);
        if ((q.x - ax) ** 2 + (q.z - az) ** 2 < R * R) { hp += b.hp; n++; cx += q.x; cz += q.z; }
      }
      if (hp > bestHp) { bestHp = hp; best = { x: cx / n, z: cz / n, hp, n }; }
    }
    return best;
  }

  private pushLane(force: boolean): boolean {
    const affordable = this.affordableUnits();
    if (!affordable.length) return false;

    let laneSign = this.lane;
    if (this.cfg.exploitLanes) {
      const deadP = this.game.towers.find((t) => t.team === 0 && t.kind === 'princess' && !t.alive);
      if (deadP) {
        laneSign = Math.sign(deadP.pos.x) || 1;
      } else {
        const princes = this.game.towers.filter((t) => t.team === 0 && t.kind === 'princess' && t.alive);
        if (princes.length === 2) {
          const weak = princes[0].hp <= princes[1].hp ? princes[0] : princes[1];
          laneSign = Math.sign(weak.pos.x) || 1;
        }
      }
    } else {
      laneSign = Math.random() < 0.5 ? 1 : -1;
    }
    this.lane = laneSign;

    const pick = force
      ? affordable.reduce((a, b) => (a.card.cost <= b.card.cost ? a : b))
      : affordable.reduce((a, b) => (b.card.hp > a.card.hp ? b : a)); // lead with a tank
    const x = laneSign * ARENA.bridgeX + (Math.random() - 0.5);
    this.deploy(pick, new THREE.Vector3(x, 0, -ARENA.halfL + 2));
    return true;
  }

  private affordableUnits(): HandCard[] {
    return this.deck.hand
      .map((card, i) => ({ card, i }))
      .filter(({ card }) => !card.spell && card.cost <= this.elixir);
  }

  private deploy(entry: HandCard, pos: THREE.Vector3) {
    const { card, i } = entry;
    if (card.cost > this.elixir) return;
    // defensive buildings anchor mid-lane in front of the towers
    const at = card.building
      ? new THREE.Vector3(THREE.MathUtils.clamp(pos.x, -3, 3), 0, -5.5)
      : pos;
    this.elixir -= card.cost;
    this.deck.play(i);
    this.game.spawnUnits(1, card, at);
  }
}
