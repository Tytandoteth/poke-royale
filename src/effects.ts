import * as THREE from 'three';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  maxLife: number;
  gravity: number;
}

let circleTex: THREE.Texture | null = null;
function getCircleTex(): THREE.Texture {
  if (circleTex) return circleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  circleTex = new THREE.CanvasTexture(c);
  return circleTex;
}

interface Flash {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
}

export class Effects {
  private scene: THREE.Scene;
  private bursts: Burst[] = [];
  private flashes: Flash[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Small stationary fading puff — used for projectile trails. */
  trail(pos: THREE.Vector3, color: number, size = 0.16) {
    this.burst(pos, color, 1, 0.15, size, 0.28, 0);
  }

  /** Fiery explosion for Fire Blast. */
  fireBlast(pos: THREE.Vector3) {
    const p = pos.clone().setY(0.5);
    this.burst(p, 0xff7a2d, 26, 7, 0.32, 0.55);
    this.burst(p, 0xff3c1a, 14, 5, 0.28, 0.5);
    this.burst(p, 0xffd34d, 12, 9, 0.22, 0.4);
    this.burst(p, 0x55504a, 10, 3, 0.4, 0.9, 2);
  }

  /** Crystalline shatter for Ice Beam. */
  iceBlast(pos: THREE.Vector3) {
    const p = pos.clone().setY(0.5);
    this.burst(p, 0xbfeaff, 24, 6, 0.28, 0.7, 3);
    this.burst(p, 0xffffff, 12, 4, 0.2, 0.5, 3);
    this.burst(p, 0x6fc6e8, 10, 8, 0.24, 0.45);
  }

  /** Jagged lightning column from the sky. */
  lightning(pos: THREE.Vector3) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xeaf2ff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    let x = 0, z = 0;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 6), mat);
      seg.position.set(x, 15 - i * 4 + 2, z);
      x += (Math.random() - 0.5) * 0.9;
      z += (Math.random() - 0.5) * 0.9;
      seg.position.x = (seg.position.x + x) / 2;
      seg.position.z = (seg.position.z + z) / 2;
      seg.rotation.x = (Math.random() - 0.5) * 0.25;
      seg.rotation.z = (Math.random() - 0.5) * 0.25;
      group.add(seg);
    }
    group.position.set(pos.x, 0, pos.z);
    this.scene.add(group);
    this.flashes.push({ mesh: group, life: 0.35, maxLife: 0.35 });
    this.burst(new THREE.Vector3(pos.x, 0.4, pos.z), 0xbfd9ff, 24, 8, 0.3, 0.5);
    this.burst(new THREE.Vector3(pos.x, 0.4, pos.z), 0xfff7ae, 12, 5, 0.25, 0.4);
  }

  burst(pos: THREE.Vector3, color: number, count = 10, speed = 4, size = 0.22, life = 0.45, gravity = 6) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.6);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s;
      velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * s * 0.9 + 1;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size, map: getCircleTex(),
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, velocities, life, maxLife: life, gravity });
  }

  update(dt: number) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
        this.flashes.splice(i, 1);
        continue;
      }
      const frac = f.life / f.maxLife;
      f.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m) m.opacity = frac;
      });
      f.mesh.scale.x = f.mesh.scale.z = 0.5 + frac * 0.5;
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const attr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let j = 0; j < arr.length / 3; j++) {
        b.velocities[j * 3 + 1] -= b.gravity * dt;
        arr[j * 3] += b.velocities[j * 3] * dt;
        arr[j * 3 + 1] += b.velocities[j * 3 + 1] * dt;
        arr[j * 3 + 2] += b.velocities[j * 3 + 2] * dt;
        if (arr[j * 3 + 1] < 0.05) arr[j * 3 + 1] = 0.05;
      }
      attr.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = b.life / b.maxLife;
    }
  }
}

/** Billboard HP bar drawn on a small canvas sprite. */
export class HpBar {
  sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private team: number;

  constructor(parentScene: THREE.Scene, team: number, width = 1.15, height = 0.18) {
    this.team = team;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 12;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(width, height, 1);
    this.sprite.renderOrder = 999;
    this.set(1);
    parentScene.add(this.sprite);
  }

  set(frac: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 64, 12);
    ctx.fillStyle = 'rgba(10,10,18,0.85)';
    ctx.fillRect(0, 0, 64, 12);
    ctx.fillStyle = this.team === 0 ? '#3ddc5a' : '#ff5252';
    ctx.fillRect(1.5, 1.5, Math.max(0, frac) * 61, 9);
    this.tex.needsUpdate = true;
  }

  setPosition(x: number, y: number, z: number) {
    this.sprite.position.set(x, y, z);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.sprite);
    this.tex.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}
