import * as THREE from 'three';
import type { Combatant, ProjectileSpec } from './types';
import type { Game } from './game';

const _dest = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Projectile {
  game: Game;
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  target: Combatant;
  lastDest: THREE.Vector3;
  spec: ProjectileSpec;
  dmg: number;
  team: number;
  t = 0;
  duration: number;
  private trailT = 0;

  constructor(game: Game, from: THREE.Vector3, target: Combatant, spec: ProjectileSpec, dmg: number, team: number) {
    this.game = game;
    this.start = from.clone();
    this.target = target;
    this.spec = spec;
    this.dmg = dmg;
    this.team = team;
    this.lastDest = target.getPosition().setY(target.isBuilding ? 1.6 : 0.7);
    this.duration = Math.max(0.08, this.start.distanceTo(this.lastDest) / spec.speed);

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.size, 8, 6),
      new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 2.2,
        roughness: 0.4,
      }),
    );
    this.mesh.position.copy(from);
    game.scene.add(this.mesh);
  }

  /** Returns false when finished. */
  update(dt: number): boolean {
    if (this.target.alive) {
      this.target.getPosition(_dest).setY(this.target.isBuilding ? 1.6 : 0.7);
      this.lastDest.copy(_dest);
    }
    this.t += dt / this.duration;
    if (this.t >= 1) {
      this.impact();
      return false;
    }
    const p = this.mesh.position;
    p.lerpVectors(this.start, this.lastDest, this.t);
    p.y += this.spec.arc * 4 * this.t * (1 - this.t) * this.start.distanceTo(this.lastDest) * 0.25;
    this.trailT += dt;
    if (this.trailT > 0.035) {
      this.trailT = 0;
      this.game.effects.trail(p, this.spec.color, this.spec.size * 1.1);
    }
    return true;
  }

  private impact() {
    const pos = this.lastDest;
    this.game.effects.burst(pos, this.spec.color, this.spec.splash ? 16 : 8, this.spec.splash ? 6 : 3.5, 0.22, 0.4);
    this.game.audio.hit();
    _dir.subVectors(pos, this.start).setY(0).normalize();
    if (this.spec.splash) {
      this.game.areaDamage(this.team, pos, this.spec.splash, this.dmg);
    } else if (this.target.alive) {
      this.target.takeDamage(this.dmg, _dir.clone());
    }
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
