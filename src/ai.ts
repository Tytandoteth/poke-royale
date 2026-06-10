import * as THREE from 'three';
import { ARENA, MATCH } from './types';
import { Deck } from './cards';
import type { Game } from './game';

const _pos = new THREE.Vector3();

/** Simple elixir-fair AI: defends threats, builds pushes when rich. */
export class AiController {
  game: Game;
  deck: Deck;
  elixir = MATCH.startElixir;
  thinkT = 2.5;

  constructor(game: Game, deckIds: string[]) {
    this.game = game;
    this.deck = new Deck(deckIds, true);
  }

  update(dt: number, rate: number) {
    this.elixir = Math.min(MATCH.maxElixir, this.elixir + rate * dt);
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.7 + Math.random() * 1.1;

    // grace period: don't open with an unprovoked rush
    const isEarlyGame = this.game.time < 12;

    const affordable = this.deck.hand
      .map((card, i) => ({ card, i }))
      .filter(({ card }) => card.cost <= this.elixir);
    if (affordable.length === 0) return;

    // biggest player threat on AI side of the field
    let threat: THREE.Vector3 | null = null;
    let threatHp = 0;
    for (const u of this.game.units) {
      if (u.team !== 0 || !u.alive) continue;
      u.getPosition(_pos);
      if (_pos.z < -0.5 && u.hp > threatHp) {
        threatHp = u.hp;
        threat = _pos.clone();
      }
    }

    const deployZ = (z: number) => THREE.MathUtils.clamp(z, -ARENA.halfL + 0.8, -1.4);
    const deployX = (x: number) => THREE.MathUtils.clamp(x, -ARENA.halfW + 0.8, ARENA.halfW - 0.8);

    // thunder a juicy cluster of player units
    const thunderIdx = this.deck.hand.findIndex((c) => c.spell && c.cost <= this.elixir);
    if (thunderIdx >= 0) {
      const cluster = this.findCluster();
      if (cluster) {
        const card = this.deck.hand[thunderIdx];
        this.elixir -= card.cost;
        this.deck.play(thunderIdx);
        this.game.castSpell(1, card, cluster);
        return;
      }
    }

    if (!threat && isEarlyGame) return;

    if (threat) {
      // defend: drop a counter between the threat and our towers
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      const pos = new THREE.Vector3(
        deployX(threat.x + (Math.random() - 0.5) * 2.5),
        0,
        deployZ(threat.z - 2.5),
      );
      this.play(pick.i, pos);
    } else if (this.elixir >= 9) {
      // rich: start a push from the back with the most expensive card
      affordable.sort((a, b) => b.card.cost - a.card.cost);
      const lane = Math.random() > 0.5 ? ARENA.bridgeX : -ARENA.bridgeX;
      this.play(affordable[0].i, new THREE.Vector3(lane + (Math.random() - 0.5), 0, -ARENA.halfL + 2));
    } else if (this.elixir >= 6 && Math.random() < 0.5) {
      // support an existing push or probe a lane
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      const lane = Math.random() > 0.5 ? ARENA.bridgeX : -ARENA.bridgeX;
      this.play(pick.i, new THREE.Vector3(lane + (Math.random() - 0.5) * 1.5, 0, -(2.5 + Math.random() * 5)));
    }
  }

  /** Centroid of >=2 player units within 2.2 of each other and worth >=500 hp total. */
  private findCluster(): THREE.Vector3 | null {
    const players = this.game.units.filter((u) => u.team === 0 && u.alive);
    for (const a of players) {
      a.getPosition(_pos);
      const ax = _pos.x, az = _pos.z;
      let n = 0, hp = 0, cx = 0, cz = 0;
      for (const b of players) {
        const p = b.getPosition(new THREE.Vector3());
        const dx = p.x - ax, dz = p.z - az;
        if (dx * dx + dz * dz < 2.2 * 2.2) {
          n++; hp += b.hp; cx += p.x; cz += p.z;
        }
      }
      if (n >= 2 && hp >= 500) return new THREE.Vector3(cx / n, 0, cz / n);
    }
    return null;
  }

  private play(handIndex: number, pos: THREE.Vector3) {
    const card = this.deck.hand[handIndex];
    if (card.cost > this.elixir) return;
    if (card.spell) return; // spells handled separately
    // defensive buildings always go mid-lane in front of the towers
    const at = card.building
      ? new THREE.Vector3(THREE.MathUtils.clamp(pos.x, -3, 3), 0, -5.5)
      : pos;
    this.elixir -= card.cost;
    this.deck.play(handIndex);
    this.game.spawnUnits(1, card, at);
  }
}
