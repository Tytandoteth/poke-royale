import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA, FLY_HEIGHT, GROUP, groups, distXZ } from './types';
import type { Combatant, UnitStats } from './types';
import { buildUnitModel } from './models';
import { HpBar } from './effects';
import type { Game } from './game';

const _pos = new THREE.Vector3();
const _tPos = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Unit implements Combatant {
  game: Game;
  stats: UnitStats;
  team: number;
  alive = true;
  flying: boolean;
  isBuilding = false;
  hp: number;
  maxHp: number;
  radius: number;

  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  creature: THREE.Object3D;
  hpBar: HpBar;

  target: Combatant | null = null;
  retargetT = 0;
  attackT = 0.45;
  lungeT = 0;       // attack animation timer
  walkPhase = Math.random() * 10;
  deadT = 0;        // ragdoll/fade countdown after death
  yaw = 0;
  flashT = 0;       // hit flash timer
  staggerT = 0;     // big-hit stun timer
  frozenT = 0;      // ice beam freeze timer
  private decayAccum = 0;
  private flashMats: { m: THREE.MeshStandardMaterial; e: number; i: number }[] = [];

  constructor(game: Game, stats: UnitStats, team: number, pos: THREE.Vector3) {
    this.game = game;
    this.stats = stats;
    this.team = team;
    this.flying = stats.flying;
    this.isBuilding = !!stats.building;
    this.hp = this.maxHp = stats.hp;
    this.radius = stats.radius;
    this.yaw = team === 0 ? Math.PI : 0; // face the enemy side

    const halfHeight = Math.max(0.05, stats.height / 2 - stats.radius);
    // ground units drop in from above for a deploy "thump"; buildings are placed
    const centerY = stats.flying ? FLY_HEIGHT
      : stats.building ? stats.height / 2 + 0.05
      : stats.height / 2 + 1.3;

    const desc = (stats.building ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
      .setTranslation(pos.x, centerY, pos.z)
      .lockRotations()
      .setLinearDamping(0.4);
    if (stats.flying) desc.setGravityScale(0);
    this.body = game.world.createRigidBody(desc);

    const colGroups = stats.flying
      ? groups(GROUP.FLY, GROUP.GROUND | GROUP.FLY | GROUP.TOWER)
      : groups(GROUP.UNIT, GROUP.GROUND | GROUP.UNIT | GROUP.TOWER | GROUP.BLOCK);
    this.collider = game.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, stats.radius)
        .setDensity(0.6 + stats.hp / 600)
        .setFriction(0.1)
        .setCollisionGroups(colGroups),
      this.body,
    );

    this.mesh = buildUnitModel(stats.id, team, stats.radius);
    this.creature = this.mesh.userData.creature;
    this.creature.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.emissive) this.flashMats.push({ m, e: m.emissive.getHex(), i: m.emissiveIntensity });
    });
    this.mesh.rotation.y = this.yaw;
    game.scene.add(this.mesh);

    this.hpBar = new HpBar(game.scene, team);
    this.syncMesh();
  }

  getPosition(out?: THREE.Vector3): THREE.Vector3 {
    const t = this.body.translation();
    return (out ?? new THREE.Vector3()).set(t.x, t.y, t.z);
  }

  update(dt: number) {
    if (!this.alive) {
      this.deadT -= dt;
      this.syncMesh(true);
      // fade out
      const f = Math.min(1, Math.max(0, this.deadT / 0.6));
      this.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) { m.transparent = true; m.opacity = f; }
      });
      return;
    }

    this.getPosition(_pos);

    // frozen solid
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      if (this.frozenT <= 0) {
        for (const f of this.flashMats) { f.m.emissive.setHex(f.e); f.m.emissiveIntensity = f.i; }
      }
      if (!this.isBuilding) {
        const lv = this.body.linvel();
        this.body.setLinvel({ x: 0, y: this.flying ? this.hoverVel(_pos.y) : lv.y, z: 0 }, true);
      }
      this.syncMesh();
      return;
    }

    // defensive buildings slowly decay
    if (this.isBuilding) {
      this.decayAccum += dt;
      if (this.decayAccum >= 0.5) {
        this.hp -= this.maxHp * (0.5 / 40); // gone in ~40s untouched
        this.decayAccum = 0;
        this.hpBar.set(this.hp / this.maxHp);
        if (this.hp <= 0) { this.die(); return; }
      }
    }

    // hit flash recovery
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        for (const f of this.flashMats) { f.m.emissive.setHex(f.e); f.m.emissiveIntensity = f.i; }
      }
    }
    // staggered: stand there reeling
    if (this.staggerT > 0) {
      this.staggerT -= dt;
      const lv = this.body.linvel();
      this.body.setLinvel({ x: 0, y: this.flying ? this.hoverVel(_pos.y) : lv.y, z: 0 }, true);
      this.creature.rotation.x = -0.3 * (this.staggerT / 0.25);
      this.syncMesh();
      return;
    }

    // retarget periodically or when target dies
    this.retargetT -= dt;
    if (this.retargetT <= 0 || !this.target || !this.target.alive) {
      this.target = this.game.findTarget(this);
      this.retargetT = 0.25;
    }

    this.attackT = Math.max(-0.01, this.attackT - dt);

    if (this.target) {
      this.target.getPosition(_tPos);
      const gap = distXZ(_pos, _tPos) - this.radius - this.target.radius;
      const heightOk = this.flying || !this.target.flying || this.stats.range > 2 || this.stats.targetsAir;

      if (gap <= this.stats.range && heightOk) {
        // in range: stop and attack
        if (!this.isBuilding) {
          const lv = this.body.linvel();
          this.body.setLinvel({ x: 0, y: this.flying ? this.hoverVel(_pos.y) : lv.y, z: 0 }, true);
        }
        this.faceTowards(_tPos, dt);
        if (this.attackT <= 0) {
          this.performAttack();
          this.attackT = this.stats.attackInterval;
          this.lungeT = 0.32;
        }
      } else if (this.isBuilding) {
        // buildings never chase
      } else {
        // move toward waypoint
        const wp = this.waypoint(_pos, _tPos);
        _dir.set(wp.x - _pos.x, 0, wp.z - _pos.z);
        if (_dir.lengthSq() > 0.001) _dir.normalize();
        const vy = this.flying ? this.hoverVel(_pos.y) : this.body.linvel().y;
        this.body.setLinvel(
          { x: _dir.x * this.stats.speed, y: vy, z: _dir.z * this.stats.speed },
          true,
        );
        this.faceTowards(_pos.clone().add(_dir), dt);
      }
    }

    this.lungeT = Math.max(0, this.lungeT - dt);
    this.walkPhase += dt * this.stats.speed * 3.2;
    this.syncMesh();
  }

  private hoverVel(y: number): number {
    return (FLY_HEIGHT - y) * 3;
  }

  /** Ground units must cross at a bridge. */
  private waypoint(pos: THREE.Vector3, targetPos: THREE.Vector3): THREE.Vector3 {
    if (this.flying) return targetPos;
    const needCross = Math.sign(pos.z) !== Math.sign(targetPos.z) && Math.abs(pos.z) > ARENA.riverHalfW + 0.4;
    if (needCross) {
      const bx = pos.x >= 0 ? ARENA.bridgeX : -ARENA.bridgeX;
      _dir.set(bx, 0, -Math.sign(pos.z) * 0.6);
      return _dir;
    }
    return targetPos;
  }

  private faceTowards(p: THREE.Vector3, dt: number) {
    const t = this.body.translation();
    const targetYaw = Math.atan2(p.x - t.x, p.z - t.z);
    let d = targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 10);
  }

  private performAttack() {
    if (!this.target) return;
    if (this.stats.projectile) {
      this.getPosition(_pos);
      _pos.y = this.flying ? FLY_HEIGHT : this.stats.height * 0.7;
      this.game.spawnProjectile(_pos.clone(), this.target, this.stats.projectile, this.stats.dmg, this.team);
      this.game.audio.zap();
    } else {
      this.target.getPosition(_tPos);
      this.getPosition(_pos);
      _dir.subVectors(_tPos, _pos).setY(0).normalize();
      this.target.takeDamage(this.stats.dmg, _dir.clone());

      const impact = _tPos.clone().setY(Math.max(0.6, _tPos.y));
      const typeColor = parseInt(this.stats.uiColor.slice(1), 16);
      const style = this.stats.meleeStyle ?? 'punch';
      let kb = 1.6, lift = 0.6;
      const fx = this.game.effects;
      switch (style) {
        case 'punch': // sharp white shockwave + sparks
          fx.burst(impact, 0xffffff, 9, 6, 0.16, 0.26);
          fx.burst(impact, typeColor, 6, 3, 0.18, 0.3);
          kb = 2.4; lift = 0.7;
          break;
        case 'slam': // ground dust + heavy lift, tiny shake
          fx.burst(impact.clone().setY(0.3), 0x9a8a6a, 16, 4.5, 0.3, 0.6, 7);
          fx.burst(impact, typeColor, 8, 4, 0.22, 0.4);
          this.game.rig.shake(0.12);
          kb = 3.2; lift = 1.5;
          break;
        case 'slash': // fast purple arc
          fx.burst(impact, typeColor, 11, 7, 0.16, 0.26);
          fx.burst(impact, 0xffffff, 4, 5, 0.14, 0.22);
          kb = 1.8;
          break;
        case 'bite': // small quick nip
          fx.burst(impact, typeColor, 5, 3, 0.13, 0.24);
          kb = 1.1;
          break;
      }
      if (this.target.isBuilding || style === 'slam') this.game.audio.thud();
      else this.game.audio.hit();

      const t = this.target as Unit;
      if (!this.target.isBuilding && t.body && t.alive) {
        const m = t.body.mass();
        t.body.applyImpulse({ x: _dir.x * m * kb, y: m * lift, z: _dir.z * m * kb }, true);
      }
    }
  }

  takeDamage(dmg: number, fromDir?: THREE.Vector3) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hpBar.set(this.hp / this.maxHp);
    this.getPosition(_pos);
    this.game.dmgNums.spawn(_pos.clone().setY(_pos.y + this.stats.height * 0.6), dmg, this.team === 0 ? 'friendly' : 'enemy');
    // white hit flash (unless frozen — keep the ice tint)
    if (this.frozenT <= 0) {
      for (const f of this.flashMats) { f.m.emissive.setHex(0xffffff); f.m.emissiveIntensity = 0.55; }
      this.flashT = 0.09;
    }
    // big hits stagger
    if (dmg >= this.maxHp * 0.15 && this.hp > 0) this.staggerT = Math.max(this.staggerT, 0.25);
    if (this.hp <= 0) this.die(fromDir);
  }

  freeze(dur: number) {
    if (!this.alive) return;
    this.frozenT = Math.max(this.frozenT, dur);
    this.flashT = 0;
    for (const f of this.flashMats) { f.m.emissive.setHex(0x7fd4ff); f.m.emissiveIntensity = 0.55; }
  }

  private die(fromDir?: THREE.Vector3) {
    this.alive = false;
    this.deadT = this.isBuilding ? 0.8 : 1.5;
    this.hpBar.dispose(this.game.scene);
    if (this.isBuilding) {
      // buildings crumble instead of ragdolling
      this.getPosition(_pos);
      const typeColor = parseInt(this.stats.uiColor.slice(1), 16);
      this.game.effects.burst(_pos, typeColor, 20, 5, 0.3, 0.6);
      this.game.audio.thud();
      return;
    }
    // ragdoll: unlock rotations, restore gravity, fling the body
    this.body.setEnabledRotations(true, true, true, true);
    this.body.setGravityScale(1, true);
    this.collider.setCollisionGroups(groups(GROUP.UNIT, GROUP.GROUND));
    const m = this.body.mass();
    const dir = fromDir ?? new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.body.applyImpulse({ x: dir.x * m * 4, y: m * 5, z: dir.z * m * 4 }, true);
    this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m }, true);
    this.getPosition(_pos);
    // type-themed death burst
    const typeColor = parseInt(this.stats.uiColor.slice(1), 16);
    this.game.effects.burst(_pos, typeColor, 16, 5.5, 0.26, 0.55);
    this.game.effects.burst(_pos, 0xffffff, 8, 3.5, 0.2, 0.4);
  }

  private syncMesh(ragdoll = false) {
    const t = this.body.translation();
    const yOffset = this.stats.height / 2;
    if (ragdoll) {
      const r = this.body.rotation();
      this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      this.mesh.position.set(t.x, t.y - yOffset * 0.6, t.z);
    } else {
      this.mesh.position.set(t.x, t.y - yOffset, t.z);
      this.mesh.rotation.set(0, this.yaw, 0);

      // procedural animation
      const lv = this.body.linvel();
      const speed2 = lv.x * lv.x + lv.z * lv.z;
      const moving = speed2 > 0.4;
      const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.09 : Math.sin(this.walkPhase * 0.4) * 0.02;
      this.creature.rotation.x = moving ? Math.sin(this.walkPhase) * 0.06 : 0;
      // attack lunge — flavored per melee style
      let lungeZ = 0, lungeY = 0;
      if (this.lungeT > 0) {
        const phase = (0.32 - this.lungeT) / 0.32; // 0..1
        const swing = Math.sin(phase * Math.PI);
        switch (this.stats.meleeStyle) {
          case 'slam': // rear up then slam down
            lungeY = Math.sin(phase * Math.PI) * (phase < 0.5 ? 0.3 : -0.25);
            lungeZ = swing * 0.2;
            this.creature.rotation.x = -0.3 * Math.cos(phase * Math.PI);
            break;
          case 'slash': // quick deep dash
            lungeZ = Math.sin(phase * Math.PI * 0.9) * 0.5;
            break;
          case 'bite': // little hop-forward nip
            lungeZ = swing * 0.22;
            lungeY = swing * 0.14;
            break;
          case 'punch':
          default: // sharp jab
            lungeZ = Math.sin(phase * Math.PI) ** 0.6 * 0.42;
        }
      }
      this.creature.position.y = bob + lungeY;
      this.creature.position.z = lungeZ;
      // wings flap / flame flicker
      const wings = this.creature.userData.wings as THREE.Mesh[] | undefined;
      if (wings) {
        const flap = Math.sin(performance.now() * 0.012) * 0.45;
        wings[0].rotation.z = 0.45 + flap;
        wings[1].rotation.z = -0.45 - flap;
      }
      const flame = this.creature.userData.flame as THREE.Mesh | undefined;
      if (flame) {
        const s = 1 + Math.sin(performance.now() * 0.02) * 0.25;
        flame.scale.set(s, s * 1.2, s);
      }
    }
    this.hpBar.setPosition(t.x, t.y + yOffset + 0.35, t.z);
  }

  dispose() {
    this.game.world.removeRigidBody(this.body);
    this.game.scene.remove(this.mesh);
    if (this.alive) this.hpBar.dispose(this.game.scene);
    this.mesh.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) (mesh.material as THREE.Material).dispose();
    });
  }
}
