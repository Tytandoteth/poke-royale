import * as THREE from 'three';
import { TEAM_COLOR } from './types';

function std(color: number, opts: { emissive?: boolean; intensity?: number; rough?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    metalness: 0.05,
    flatShading: true,
    emissive: opts.emissive ? color : 0x000000,
    emissiveIntensity: opts.intensity ?? (opts.emissive ? 0.8 : 0),
  });
}

type Vec3ish = [number, number, number];

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: Vec3ish = [0, 0, 0],
  rot: Vec3ish = [0, 0, 0],
  scale: Vec3ish = [1, 1, 1],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const sphere = (r: number, seg = 18) => new THREE.SphereGeometry(r, seg, Math.max(10, seg - 2));
const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

/* ------------------------------------------------------------------ */
/* Procedural detail (bump) textures — give bodies real surface       */
/* ------------------------------------------------------------------ */

type SkinKind = 'fur' | 'scale' | 'skin' | 'rock' | 'plant';
const _texCache: Partial<Record<SkinKind, THREE.Texture>> = {};

function makeDetail(kind: SkinKind): THREE.Texture {
  const cached = _texCache[kind];
  if (cached) return cached;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080'; // neutral mid-gray = flat bump
  ctx.fillRect(0, 0, S, S);

  if (kind === 'fur') {
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.7, l = 3 + Math.random() * 4;
      ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  } else if (kind === 'scale') {
    const r = 11;
    for (let yy = 0; yy < S + r; yy += r * 0.78) {
      const off = ((yy / (r * 0.78)) % 2) * r / 2;
      for (let xx = -r; xx < S + r; xx += r) {
        ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(xx + off, yy, r * 0.6, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.beginPath(); ctx.arc(xx + off, yy - 1.6, r * 0.6, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      }
    }
  } else if (kind === 'rock') {
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * S, y = Math.random() * S, w = 6 + Math.random() * 18, h = 6 + Math.random() * 18;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)';
      ctx.fillRect(x, y, w, h);
    }
  } else if (kind === 'plant') {
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * S, y = Math.random() * S, r2 = 2 + Math.random() * 6;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // skin: fine soft noise
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  _texCache[kind] = t;
  return t;
}

interface Skin { kind: SkinKind; smooth: boolean; bump?: number; }
const SKIN: Record<string, Skin> = {
  pikachu: { kind: 'fur', smooth: true }, eevee: { kind: 'fur', smooth: true }, snorlax: { kind: 'fur', smooth: true },
  charizard: { kind: 'scale', smooth: true }, dragonite: { kind: 'scale', smooth: true },
  squirtle: { kind: 'skin', smooth: true }, gengar: { kind: 'skin', smooth: true },
  machamp: { kind: 'skin', smooth: true }, machoke: { kind: 'skin', smooth: true }, zubat: { kind: 'skin', smooth: true },
  bulbasaur: { kind: 'plant', smooth: true }, golem: { kind: 'rock', smooth: false },
};

/** Give a built creature tactile surface relief + smooth organic shading. */
function applySkin(creature: THREE.Object3D, skin: Skin) {
  const tex = makeDetail(skin.kind);
  const bump = skin.bump ?? (skin.kind === 'rock' ? 0.08 : skin.kind === 'scale' ? 0.05 : 0.035);
  creature.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !m.isMeshStandardMaterial) return;
    if (m.emissiveIntensity > 0.4) return; // leave glowing parts (eyes, flames, cheeks) alone
    m.bumpMap = tex;
    m.bumpScale = bump;
    m.flatShading = !skin.smooth;
    m.needsUpdate = true;
  });
}

function eyes(parent: THREE.Object3D, y: number, z: number, spread: number, r = 0.05) {
  const mat = std(0x14141a, { rough: 0.4 });
  add(parent, sphere(r, 8), mat, [spread, y, z]);
  add(parent, sphere(r, 8), mat, [-spread, y, z]);
}

/* ------------------------------------------------------------------ */
/* Creatures (origin at feet, facing +Z)                               */
/* ------------------------------------------------------------------ */

function pikachu(): THREE.Group {
  const g = new THREE.Group();
  const yellow = std(0xf5d033);
  const black = std(0x1c1c22);
  add(g, sphere(0.42), yellow, [0, 0.46, 0], [0, 0, 0], [1, 1.12, 0.95]);
  // ears
  const earL = add(g, cone(0.1, 0.52), yellow, [0.2, 1.08, -0.02], [0, 0, -0.35]);
  const earR = add(g, cone(0.1, 0.52), yellow, [-0.2, 1.08, -0.02], [0, 0, 0.35]);
  add(earL, cone(0.075, 0.2), black, [0, 0.2, 0]);
  add(earR, cone(0.075, 0.2), black, [0, 0.2, 0]);
  // cheeks
  const red = std(0xe04a3a, { emissive: true, intensity: 0.25 });
  add(g, sphere(0.085, 8), red, [0.31, 0.52, 0.26]);
  add(g, sphere(0.085, 8), red, [-0.31, 0.52, 0.26]);
  eyes(g, 0.62, 0.35, 0.16);
  // zigzag tail
  const t1 = add(g, box(0.1, 0.32, 0.06), yellow, [0.08, 0.42, -0.42], [0.5, 0, 0.5]);
  add(t1, box(0.12, 0.34, 0.06), yellow, [-0.1, 0.26, 0], [0, 0, -1.0]);
  // feet
  add(g, sphere(0.13, 8), yellow, [0.18, 0.1, 0.1]);
  add(g, sphere(0.13, 8), yellow, [-0.18, 0.1, 0.1]);
  return g;
}

function charizard(): THREE.Group {
  const g = new THREE.Group();
  const orange = std(0xe8702e);
  const cream = std(0xf2dba0);
  const teal = std(0x2e8a8a);
  add(g, sphere(0.5), orange, [0, 0.78, 0], [0, 0, 0], [0.9, 1.18, 0.95]);
  add(g, sphere(0.36), cream, [0, 0.72, 0.22], [0, 0, 0], [0.78, 1.0, 0.6]);
  const head = add(g, sphere(0.32), orange, [0, 1.52, 0.12]);
  add(head, box(0.2, 0.14, 0.26), orange, [0, -0.08, 0.3]);
  add(head, sphere(0.05, 6), std(0x2a1a10), [0.06, -0.05, 0.44]);
  add(head, sphere(0.05, 6), std(0x2a1a10), [-0.06, -0.05, 0.44]);
  add(head, cone(0.06, 0.22, 6), orange, [0.12, 0.3, -0.05], [0, 0, -0.2]);
  add(head, cone(0.06, 0.22, 6), orange, [-0.12, 0.3, -0.05], [0, 0, 0.2]);
  eyes(head, 0.12, 0.26, 0.14, 0.045);
  // wings
  const wingGeo = box(1.05, 0.05, 0.62);
  const wingL = add(g, wingGeo, teal, [0.62, 1.25, -0.18], [0.15, 0.25, 0.45]);
  const wingR = add(g, wingGeo, teal, [-0.62, 1.25, -0.18], [0.15, -0.25, -0.45]);
  // tail + flame
  add(g, cone(0.14, 0.85, 6), orange, [0, 0.55, -0.62], [-1.9, 0, 0]);
  const flame = add(
    g, sphere(0.16, 8),
    std(0xffae2d, { emissive: true, intensity: 1.6 }),
    [0, 0.62, -1.05],
  );
  add(g, sphere(0.16, 8), orange, [0.42, 0.28, 0.05]);
  add(g, sphere(0.16, 8), orange, [-0.42, 0.28, 0.05]);
  g.userData.wings = [wingL, wingR];
  g.userData.flame = flame;
  return g;
}

function squirtle(): THREE.Group {
  const g = new THREE.Group();
  const blue = std(0x6fc1ea);
  const shell = std(0x9a6b3f);
  const rim = std(0xf2e6c4);
  add(g, sphere(0.34), blue, [0, 0.4, 0.04], [0, 0, 0], [1, 1.05, 0.9]);
  add(g, sphere(0.4), shell, [0, 0.45, -0.16], [0, 0, 0], [0.92, 0.92, 0.62]);
  add(g, new THREE.TorusGeometry(0.34, 0.05, 6, 14), rim, [0, 0.45, -0.16], [0.12, 0, 0], [0.95, 0.95, 1]);
  const head = add(g, sphere(0.27), blue, [0, 0.92, 0.1]);
  eyes(head, 0.08, 0.22, 0.12);
  add(g, sphere(0.11, 8), blue, [0.3, 0.5, 0.18]);
  add(g, sphere(0.11, 8), blue, [-0.3, 0.5, 0.18]);
  add(g, sphere(0.12, 8), blue, [0.16, 0.1, 0.12]);
  add(g, sphere(0.12, 8), blue, [-0.16, 0.1, 0.12]);
  add(g, cone(0.1, 0.4, 6), blue, [0, 0.35, -0.48], [-2.2, 0, 0]);
  return g;
}

function bulbasaur(): THREE.Group {
  const g = new THREE.Group();
  const body = std(0x57b9a0);
  const bulb = std(0x3aa05a);
  const bulbDark = std(0x2c7a44);
  add(g, sphere(0.42), body, [0, 0.42, 0.06], [0, 0, 0], [1.1, 0.88, 1.25]);
  const head = add(g, sphere(0.32), body, [0, 0.66, 0.42], [0, 0, 0], [1.05, 0.9, 0.9]);
  eyes(head, 0.1, 0.26, 0.16, 0.055);
  add(head, cone(0.08, 0.18, 5), body, [0.2, 0.28, -0.05], [0, 0, -0.3]);
  add(head, cone(0.08, 0.18, 5), body, [-0.2, 0.28, -0.05], [0, 0, 0.3]);
  add(g, sphere(0.32), bulb, [0, 0.82, -0.22], [0, 0, 0], [1, 1.05, 1]);
  add(g, cone(0.12, 0.3, 5), bulbDark, [0, 1.16, -0.22]);
  for (const sx of [0.28, -0.28]) {
    add(g, cyl(0.11, 0.13, 0.3, 7), body, [sx, 0.15, 0.28]);
    add(g, cyl(0.11, 0.13, 0.3, 7), body, [sx, 0.15, -0.25]);
  }
  return g;
}

function machamp(): THREE.Group {
  const g = new THREE.Group();
  const skin = std(0x8a96b8);
  const dark = std(0x3c4154);
  add(g, sphere(0.52), skin, [0, 1.0, 0], [0, 0, 0], [1.15, 1.2, 0.8]);
  add(g, box(0.85, 0.22, 0.5), dark, [0, 0.5, 0]);
  const head = add(g, sphere(0.26), skin, [0, 1.75, 0.05]);
  eyes(head, 0.05, 0.21, 0.11, 0.045);
  add(head, cone(0.1, 0.2, 4), skin, [0, 0.26, -0.06]);
  // 4 arms with fists
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 8);
  const positions: [Vec3ish, Vec3ish][] = [
    [[0.62, 1.42, 0.1], [0, 0, -1.9]],
    [[-0.62, 1.42, 0.1], [0, 0, 1.9]],
    [[0.58, 1.0, 0.15], [0, 0, -2.4]],
    [[-0.58, 1.0, 0.15], [0, 0, 2.4]],
  ];
  for (const [p, r] of positions) {
    add(g, armGeo, skin, p, r);
    add(g, sphere(0.17, 8), skin, [p[0] * 1.45, p[1] - 0.18, p[2] + 0.18]);
  }
  add(g, cyl(0.16, 0.19, 0.55, 8), skin, [0.25, 0.28, 0]);
  add(g, cyl(0.16, 0.19, 0.55, 8), skin, [-0.25, 0.28, 0]);
  return g;
}

function golem(): THREE.Group {
  const g = new THREE.Group();
  const rock = std(0x8a7355, { rough: 1 });
  const rock2 = std(0x6e5a42, { rough: 1 });
  add(g, new THREE.DodecahedronGeometry(0.68), rock, [0, 0.78, 0]);
  add(g, new THREE.DodecahedronGeometry(0.26), rock2, [0.45, 1.2, 0.2]);
  add(g, new THREE.DodecahedronGeometry(0.22), rock2, [-0.4, 1.25, -0.15]);
  add(g, new THREE.DodecahedronGeometry(0.2), rock2, [0.1, 1.35, -0.3]);
  add(g, new THREE.DodecahedronGeometry(0.3), rock2, [0.68, 0.5, 0.1]);
  add(g, new THREE.DodecahedronGeometry(0.3), rock2, [-0.68, 0.5, 0.1]);
  const eyeMat = std(0xffd34d, { emissive: true, intensity: 1.2 });
  add(g, sphere(0.07, 6), eyeMat, [0.2, 0.95, 0.58]);
  add(g, sphere(0.07, 6), eyeMat, [-0.2, 0.95, 0.58]);
  return g;
}

function gengar(): THREE.Group {
  const g = new THREE.Group();
  const purple = std(0x6d50b8);
  const dark = std(0x4a3580);
  add(g, sphere(0.5), purple, [0, 0.58, 0], [0, 0, 0], [1, 1.05, 0.92]);
  // spikes
  const spikes: Vec3ish[] = [
    [0, 1.12, -0.1], [0.25, 1.05, -0.22], [-0.25, 1.05, -0.22],
    [0.1, 0.95, -0.42], [-0.1, 0.95, -0.42],
  ];
  for (const p of spikes) add(g, cone(0.09, 0.3, 5), dark, p, [-0.4, 0, p[0] * 1.2]);
  add(g, cone(0.13, 0.42, 5), purple, [0.3, 1.12, 0], [0, 0, -0.5]);
  add(g, cone(0.13, 0.42, 5), purple, [-0.3, 1.12, 0], [0, 0, 0.5]);
  const eyeMat = std(0xff4444, { emissive: true, intensity: 1.4 });
  add(g, sphere(0.075, 8), eyeMat, [0.18, 0.72, 0.42]);
  add(g, sphere(0.075, 8), eyeMat, [-0.18, 0.72, 0.42]);
  add(g, box(0.34, 0.05, 0.08), std(0xffffff, { emissive: true, intensity: 0.3 }), [0, 0.52, 0.46]);
  add(g, sphere(0.13, 8), purple, [0.5, 0.5, 0.15]);
  add(g, sphere(0.13, 8), purple, [-0.5, 0.5, 0.15]);
  return g;
}

function eevee(): THREE.Group {
  const g = new THREE.Group();
  const brown = std(0xa8743e);
  const cream = std(0xe8d6b0);
  add(g, sphere(0.26), brown, [0, 0.3, -0.05], [0, 0, 0], [1, 0.95, 1.35]);
  const head = add(g, sphere(0.23), brown, [0, 0.6, 0.22]);
  eyes(head, 0.06, 0.18, 0.1, 0.045);
  add(head, cone(0.1, 0.34, 5), brown, [0.13, 0.3, -0.05], [0, 0, -0.3]);
  add(head, cone(0.1, 0.34, 5), brown, [-0.13, 0.3, -0.05], [0, 0, 0.3]);
  add(g, new THREE.TorusGeometry(0.17, 0.08, 6, 12), cream, [0, 0.45, 0.16], [1.3, 0, 0]);
  add(g, cone(0.14, 0.5, 6), cream, [0, 0.5, -0.5], [-2.4, 0, 0]);
  for (const sx of [0.12, -0.12]) {
    add(g, cyl(0.05, 0.06, 0.22, 6), brown, [sx, 0.1, 0.18]);
    add(g, cyl(0.05, 0.06, 0.22, 6), brown, [sx, 0.1, -0.22]);
  }
  return g;
}

function machoke(): THREE.Group {
  const g = new THREE.Group();
  const skin = std(0x9aa6cc);
  const dark = std(0x4a3e66);
  add(g, sphere(0.4), skin, [0, 0.78, 0], [0, 0, 0], [1.05, 1.15, 0.75]);
  add(g, box(0.62, 0.18, 0.4), dark, [0, 0.42, 0]);
  const head = add(g, sphere(0.22), skin, [0, 1.32, 0.05]);
  eyes(head, 0.04, 0.18, 0.09, 0.04);
  const armGeo = new THREE.CapsuleGeometry(0.11, 0.42, 4, 8);
  add(g, armGeo, skin, [0.46, 1.0, 0.1], [0, 0, -2.2]);
  add(g, armGeo, skin, [-0.46, 1.0, 0.1], [0, 0, 2.2]);
  add(g, sphere(0.14, 8), skin, [0.62, 0.82, 0.24]);
  add(g, sphere(0.14, 8), skin, [-0.62, 0.82, 0.24]);
  add(g, cyl(0.13, 0.15, 0.45, 8), skin, [0.2, 0.22, 0]);
  add(g, cyl(0.13, 0.15, 0.45, 8), skin, [-0.2, 0.22, 0]);
  return g;
}

function snorlax(): THREE.Group {
  const g = new THREE.Group();
  const teal = std(0x3f6e8c);
  const cream = std(0xf2e6c4);
  add(g, sphere(0.78), teal, [0, 0.72, 0], [0, 0, 0], [1, 0.95, 0.9]);
  add(g, sphere(0.62), cream, [0, 0.62, 0.28], [0, 0, 0], [0.85, 0.8, 0.55]);
  const head = add(g, sphere(0.34), teal, [0, 1.5, 0.12]);
  add(head, sphere(0.26), cream, [0, -0.08, 0.18], [0, 0, 0], [0.9, 0.7, 0.6]);
  add(head, cone(0.09, 0.18, 4), teal, [0.2, 0.3, -0.02]);
  add(head, cone(0.09, 0.18, 4), teal, [-0.2, 0.3, -0.02]);
  // sleepy eyes: thin dark boxes
  add(head, box(0.12, 0.025, 0.02), std(0x14141a), [0.13, 0.08, 0.31]);
  add(head, box(0.12, 0.025, 0.02), std(0x14141a), [-0.13, 0.08, 0.31]);
  add(g, sphere(0.24, 8), teal, [0.68, 0.5, 0.2]);
  add(g, sphere(0.24, 8), teal, [-0.68, 0.5, 0.2]);
  add(g, sphere(0.22, 8), cream, [0.3, 0.12, 0.55]);
  add(g, sphere(0.22, 8), cream, [-0.3, 0.12, 0.55]);
  return g;
}

function dragonite(): THREE.Group {
  const g = new THREE.Group();
  const orange = std(0xe8a23c);
  const cream = std(0xf2dba0);
  const teal = std(0x7ad4c8);
  add(g, sphere(0.42), orange, [0, 0.68, 0], [0, 0, 0], [0.95, 1.15, 0.9]);
  add(g, sphere(0.32), cream, [0, 0.6, 0.2], [0, 0, 0], [0.75, 0.95, 0.55]);
  const head = add(g, sphere(0.24), orange, [0, 1.32, 0.1]);
  add(head, box(0.16, 0.1, 0.2), orange, [0, -0.04, 0.24]);
  eyes(head, 0.08, 0.2, 0.1, 0.04);
  // antennae
  add(head, cyl(0.02, 0.02, 0.3, 5), orange, [0.08, 0.3, -0.05], [0, 0, -0.5]);
  add(head, cyl(0.02, 0.02, 0.3, 5), orange, [-0.08, 0.3, -0.05], [0, 0, 0.5]);
  add(head, sphere(0.04, 6), orange, [0.2, 0.42, -0.05]);
  add(head, sphere(0.04, 6), orange, [-0.2, 0.42, -0.05]);
  // small round wings
  const wingGeo = box(0.6, 0.04, 0.4);
  const wingL = add(g, wingGeo, teal, [0.45, 1.0, -0.15], [0.1, 0.2, 0.5]);
  const wingR = add(g, wingGeo, teal, [-0.45, 1.0, -0.15], [0.1, -0.2, -0.5]);
  add(g, cone(0.12, 0.7, 6), orange, [0, 0.4, -0.55], [-2.0, 0, 0]);
  g.userData.wings = [wingL, wingR];
  return g;
}

function zubat(): THREE.Group {
  const g = new THREE.Group();
  const blue = std(0x5a7ac4);
  const purple = std(0x8a64c4);
  add(g, sphere(0.22), blue, [0, 0.3, 0], [0, 0, 0], [1, 1.05, 0.9]);
  // big ears, no eyes (it's a zubat!)
  add(g, cone(0.07, 0.26, 5), blue, [0.1, 0.55, -0.02], [0, 0, -0.25]);
  add(g, cone(0.07, 0.26, 5), blue, [-0.1, 0.55, -0.02], [0, 0, 0.25]);
  // open mouth
  add(g, box(0.12, 0.06, 0.05), purple, [0, 0.26, 0.2]);
  const wingGeo = box(0.55, 0.03, 0.3);
  const wingL = add(g, wingGeo, purple, [0.34, 0.38, -0.05], [0, 0.15, 0.4]);
  const wingR = add(g, wingGeo, purple, [-0.34, 0.38, -0.05], [0, -0.15, -0.4]);
  g.userData.wings = [wingL, wingR];
  return g;
}

const BUILDERS: Record<string, () => THREE.Group> = {
  pikachu, charizard, squirtle, bulbasaur, machamp, golem, gengar, eevee,
  machoke, snorlax, dragonite, zubat,
};

export function buildUnitModel(id: string, team: number, unitRadius: number): THREE.Group {
  const creature = (BUILDERS[id] ?? pikachu)();
  applySkin(creature, SKIN[id] ?? { kind: 'skin', smooth: true });
  const root = new THREE.Group();
  root.add(creature);
  // team ring under the unit
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(unitRadius + 0.18, 0.045, 6, 24),
    new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  root.add(ring);
  root.userData.creature = creature;
  return root;
}

/* ------------------------------------------------------------------ */
/* Towers                                                              */
/* ------------------------------------------------------------------ */

export function buildTowerModel(kind: 'princess' | 'king', team: number): THREE.Group {
  const g = new THREE.Group();
  const stone = std(0xa7adba, { rough: 0.95 });
  const stoneDark = std(0x7e8492, { rough: 0.95 });
  const teamMat = std(TEAM_COLOR[team]);
  // carve real stone relief into the masonry
  const rockTex = makeDetail('rock');
  stone.bumpMap = stoneDark.bumpMap = rockTex;
  stone.bumpScale = stoneDark.bumpScale = 0.05;
  const r = kind === 'king' ? 1.5 : 1.1;
  const h = kind === 'king' ? 2.6 : 2.1;

  add(g, cyl(r * 0.92, r, h, 12), stone, [0, h / 2, 0]);
  add(g, cyl(r * 1.05, r * 1.05, 0.3, 12), stoneDark, [0, h + 0.15, 0]);
  // battlements
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(g, box(0.28, 0.3, 0.22), stoneDark, [Math.cos(a) * r * 0.95, h + 0.42, Math.sin(a) * r * 0.95], [0, -a, 0]);
  }
  // roof + crystal
  add(g, cone(r * 0.78, kind === 'king' ? 1.3 : 1.0, 10), teamMat, [0, h + 0.85, 0]);
  const crystal = add(
    g,
    new THREE.OctahedronGeometry(kind === 'king' ? 0.34 : 0.24),
    std(TEAM_COLOR[team], { emissive: true, intensity: 1.2 }),
    [0, h + (kind === 'king' ? 1.85 : 1.55), 0],
  );
  g.userData.crystal = crystal;
  if (kind === 'king') {
    const gold = std(0xffd34d, { rough: 0.4 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(g, cone(0.09, 0.3, 4), gold, [Math.cos(a) * 0.5, h + 1.45, Math.sin(a) * 0.5]);
    }
    add(g, new THREE.TorusGeometry(r * 1.0, 0.09, 8, 20), gold, [0, h * 0.72, 0], [Math.PI / 2, 0, 0]);
    add(g, new THREE.TorusGeometry(0.52, 0.07, 8, 16), gold, [0, h + 1.32, 0], [Math.PI / 2, 0, 0]);
  }
  add(g, box(0.7, 0.9, 0.2), stoneDark, [0, 0.45, r * 0.95]);
  return g;
}
