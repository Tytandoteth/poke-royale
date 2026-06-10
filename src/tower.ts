import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP, groups, distXZ } from './types';
import type { Combatant, ProjectileSpec } from './types';
import { buildTowerModel } from './models';
import { HpBar } from './effects';
import type { Game } from './game';

const _pos = new THREE.Vector3();
const _tPos = new THREE.Vector3();

const TOWER_STATS = {
  princess: { hp: 1700, dmg: 120, interval: 0.85, range: 7.5, radius: 1.1, height: 3.4 },
  king: { hp: 3000, dmg: 140, interval: 1.0, range: 7.2, radius: 1.5, height: 4.2 },
};

const BOLT: ProjectileSpec = { speed: 17, arc: 0.55, color: 0xffd34d, size: 0.14 };

export class Tower implements Combatant {
  game: Game;
  team: number;
  kind: 'princess' | 'king';
  alive = true;
  flying = false;
  isBuilding = true;
  hp: number;
  maxHp: number;
  radius: number;
  height: number;
  dmg: number;
  interval: number;
  range: number;
  activated: boolean;

  pos: THREE.Vector3;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  hpBar: HpBar;
  target: Combatant | null = null;
  attackT = 0.5;
  retargetT = 0;
  frozenT = 0;

  constructor(game: Game, team: number, kind: 'princess' | 'king', x: number, z: number) {
    this.game = game;
    this.team = team;
    this.kind = kind;
    const s = TOWER_STATS[kind];
    this.hp = this.maxHp = s.hp;
    this.radius = s.radius;
    this.height = s.height;
    this.dmg = s.dmg;
    this.interval = s.interval;
    this.range = s.range;
    this.activated = kind === 'princess';
    this.pos = new THREE.Vector3(x, 0, z);

    this.mesh = buildTowerModel(kind, team);
    this.mesh.position.set(x, 0, z);
    game.scene.add(this.mesh);

    this.body = game.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, s.height / 2, z));
    game.world.createCollider(
      RAPIER.ColliderDesc.cylinder(s.height / 2, s.radius)
        .setCollisionGroups(groups(GROUP.TOWER, GROUP.UNIT | GROUP.FLY)),
      this.body,
    );

    this.hpBar = new HpBar(game.scene, team, kind === 'king' ? 2.2 : 1.7, 0.26);
    this.hpBar.setPosition(x, s.height + 0.9, z);
  }

  getPosition(out?: THREE.Vector3): THREE.Vector3 {
    return (out ?? new THREE.Vector3()).copy(this.pos).setY(1.2);
  }

  activate() {
    if (this.activated || !this.alive) return;
    this.activated = true;
    this.getPosition(_pos);
    this.game.effects.burst(_pos.setY(this.height), 0xffd34d, 16, 5, 0.3, 0.6);
  }

  update(dt: number) {
    if (!this.alive) return;
    // crystal idle spin
    const crystal = this.mesh.userData.crystal as THREE.Mesh | undefined;
    if (crystal) crystal.rotation.y += dt * (this.activated ? 2.5 : 0.6);

    if (!this.activated) return;
    if (this.frozenT > 0) { this.frozenT -= dt; return; }
    this.attackT -= dt;
    this.retargetT -= dt;

    if (this.retargetT <= 0 || !this.target || !this.target.alive || this.outOfRange(this.target)) {
      this.target = this.findTarget();
      this.retargetT = 0.3;
    }
    if (this.target && this.attackT <= 0) {
      this.getPosition(_pos);
      _pos.y = this.height - 0.4;
      this.game.spawnProjectile(_pos.clone(), this.target, BOLT, this.dmg, this.team);
      this.attackT = this.interval;
    }
  }

  private outOfRange(c: Combatant): boolean {
    c.getPosition(_tPos);
    return distXZ(this.pos, _tPos) - c.radius > this.range + 0.4;
  }

  private findTarget(): Combatant | null {
    let best: Combatant | null = null;
    let bestD = Infinity;
    for (const u of this.game.units) {
      if (u.team === this.team || !u.alive) continue;
      u.getPosition(_tPos);
      const d = distXZ(this.pos, _tPos) - u.radius;
      if (d <= this.range && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  takeDamage(dmg: number) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hpBar.set(this.hp / this.maxHp);
    this.game.dmgNums.spawn(
      this.pos.clone().setY(this.height * 0.8),
      dmg,
      this.team === 0 ? 'friendly' : 'enemy',
    );
    if (this.kind === 'king') this.activate();
    if (this.hp <= 0) this.destroy();
  }

  private destroy() {
    this.alive = false;
    this.hpBar.dispose(this.game.scene);
    this.game.world.removeRigidBody(this.body);
    // rubble
    this.mesh.scale.set(1.15, 0.18, 1.15);
    this.mesh.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.color) m.color.multiplyScalar(0.55);
    });
    this.getPosition(_pos);
    this.game.effects.burst(_pos.setY(1.5), 0xffb347, 30, 8, 0.4, 0.9);
    this.game.effects.burst(_pos.clone().setY(1), 0x8a8a8a, 22, 6, 0.5, 1.1);
    // physical rubble: stone + roof-colored chunks
    this.game.debris.explode(this.pos, [0xa7adba, 0x7e8492, this.team === 0 ? 0x3b82f6 : 0xef4444]);
    this.game.onTowerDestroyed(this);
  }
}
