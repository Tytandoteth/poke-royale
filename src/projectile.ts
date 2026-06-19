import * as THREE from 'three';
import type { Combatant, ProjectileSpec, ProjectileStyle } from './types';
import type { Game } from './game';

const _dest = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _prev = new THREE.Vector3();

/** Build a distinct mesh per projectile style. */
function buildMesh(spec: ProjectileSpec): THREE.Object3D {
  const style = spec.style ?? 'orb';
  const color = spec.color;
  const glow = (c: number, intensity = 2.2) =>
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: intensity, roughness: 0.4 });

  if (style === 'bolt') {
    // electric dart: a stretched diamond that points along its flight
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(spec.size), glow(color, 2.6));
    core.scale.set(0.5, 0.5, 2.4);
    g.add(core);
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(spec.size * 0.6), glow(0xffffff, 3));
    spark.scale.set(0.6, 0.6, 1.4);
    g.add(spark);
    return g;
  }
  if (style === 'fireball') {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(spec.size, 10, 8), glow(0xffd24d, 2.4));
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(spec.size * 1.35, 10, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, transparent: true, opacity: 0.6 }),
    );
    g.add(core, shell);
    g.userData.shell = shell;
    return g;
  }
  if (style === 'bubble') {
    return new THREE.Mesh(
      new THREE.SphereGeometry(spec.size * 1.1, 10, 8),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.9,
        roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8,
      }),
    );
  }
  if (style === 'leaf') {
    // flat spinning blade
    const m = new THREE.Mesh(new THREE.ConeGeometry(spec.size * 1.3, spec.size * 2.6, 4), glow(color, 1.4));
    m.scale.set(1, 0.18, 1);
    return m;
  }
  // orb (default)
  return new THREE.Mesh(new THREE.SphereGeometry(spec.size, 8, 6), glow(color));
}

export class Projectile {
  game: Game;
  mesh: THREE.Object3D;
  style: ProjectileStyle;
  start: THREE.Vector3;
  target: Combatant;
  lastDest: THREE.Vector3;
  spec: ProjectileSpec;
  dmg: number;
  team: number;
  t = 0;
  duration: number;
  private trailT = 0;
  private spin = 0;

  constructor(game: Game, from: THREE.Vector3, target: Combatant, spec: ProjectileSpec, dmg: number, team: number) {
    this.game = game;
    this.start = from.clone();
    this.target = target;
    this.spec = spec;
    this.style = spec.style ?? 'orb';
    this.dmg = dmg;
    this.team = team;
    this.lastDest = target.getPosition().setY(target.isBuilding ? 1.6 : 0.7);
    this.duration = Math.max(0.08, this.start.distanceTo(this.lastDest) / spec.speed);

    this.mesh = buildMesh(spec);
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
    _prev.copy(p);
    p.lerpVectors(this.start, this.lastDest, this.t);
    p.y += this.spec.arc * 4 * this.t * (1 - this.t) * this.start.distanceTo(this.lastDest) * 0.25;

    this.animate(dt, _prev);
    this.emitTrail(dt, p);
    return true;
  }

  private animate(dt: number, prev: THREE.Vector3) {
    this.spin += dt * 14;
    const p = this.mesh.position;
    switch (this.style) {
      case 'bolt':
        // point along travel direction
        _dir.subVectors(p, prev);
        if (_dir.lengthSq() > 1e-6) this.mesh.lookAt(p.clone().add(_dir));
        this.mesh.rotation.z = this.spin * 2;
        break;
      case 'leaf':
        this.mesh.rotation.y = this.spin;
        this.mesh.rotation.x = this.spin * 0.5;
        break;
      case 'fireball': {
        const s = 1 + Math.sin(this.spin * 1.5) * 0.18;
        this.mesh.scale.setScalar(s);
        break;
      }
      case 'bubble':
        this.mesh.rotation.y = this.spin * 0.3;
        break;
    }
  }

  private emitTrail(dt: number, p: THREE.Vector3) {
    this.trailT += dt;
    const interval = this.style === 'fireball' ? 0.022 : 0.035;
    if (this.trailT < interval) return;
    this.trailT = 0;
    const fx = this.game.effects;
    switch (this.style) {
      case 'bolt':
        fx.trail(p, 0xffffff, this.spec.size * 0.8);
        break;
      case 'fireball':
        fx.trail(p, 0xff7a2d, this.spec.size * 1.3);
        fx.trail(p, 0x4a3a30, this.spec.size * 1.6); // smoke
        break;
      case 'bubble':
        fx.trail(p, this.spec.color, this.spec.size * 0.9);
        break;
      case 'leaf':
        fx.trail(p, this.spec.color, this.spec.size);
        break;
      default:
        fx.trail(p, this.spec.color, this.spec.size * 1.1);
    }
  }

  private impact() {
    const pos = this.lastDest;
    const fx = this.game.effects;
    switch (this.style) {
      case 'bolt':
        fx.burst(pos, 0xffffff, 8, 5, 0.16, 0.28);
        fx.burst(pos, this.spec.color, 6, 4, 0.18, 0.3);
        break;
      case 'fireball':
        fx.burst(pos, 0xff7a2d, 18, 6, 0.26, 0.45);
        fx.burst(pos, 0xffd24d, 8, 8, 0.18, 0.35);
        break;
      case 'bubble':
        fx.burst(pos, this.spec.color, 12, 4, 0.18, 0.4, 9); // heavy droplets fall
        break;
      case 'leaf':
        fx.burst(pos, this.spec.color, 10, 3.5, 0.16, 0.4);
        break;
      default:
        fx.burst(pos, this.spec.color, this.spec.splash ? 16 : 8, this.spec.splash ? 6 : 3.5, 0.22, 0.4);
    }
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
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
  }
}
