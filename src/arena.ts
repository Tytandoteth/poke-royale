import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA, GROUP, groups } from './types';

function grassTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#6db84f' : '#61aa45';
    ctx.fillRect(0, (i * 256) / rows, 256, 256 / rows);
  }
  // speckle
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#79c45a' : '#58a03e';
    ctx.globalAlpha = 0.35;
    const x = Math.random() * 256, y = Math.random() * 256;
    ctx.fillRect(x, y, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function waterTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3f8fd4');
  grad.addColorStop(1, '#2f74b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#9fd4f5';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) {
    const y = Math.random() * 256, x = Math.random() * 256;
    ctx.beginPath();
    ctx.arc(x, y, 10 + Math.random() * 14, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function tree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.2 * scale, 0.8 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1, flatShading: true }),
  );
  trunk.position.y = 0.4 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e8f3e, roughness: 0.9, flatShading: true });
  const l1 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * scale, 1.4 * scale, 8), leafMat);
  l1.position.y = 1.3 * scale;
  const l2 = new THREE.Mesh(new THREE.ConeGeometry(0.6 * scale, 1.1 * scale, 8), leafMat);
  l2.position.y = 2.0 * scale;
  l1.castShadow = l2.castShadow = true;
  g.add(l1, l2);
  return g;
}

export interface ArenaHandle {
  update(dt: number): void;
}

export function buildArena(scene: THREE.Scene, world: RAPIER.World): ArenaHandle {
  const { halfW, halfL, riverHalfW, bridgeX, bridgeHalfW } = ARENA;

  /* ---- sky / fog / lights ---- */
  scene.background = new THREE.Color(0x86b8e8);
  scene.fog = new THREE.Fog(0x86b8e8, 55, 120);

  const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x69853f, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
  sun.position.set(14, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  /* ---- ground ---- */
  const outerTex = grassTexture();
  outerTex.repeat.set(10, 14);
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 110),
    new THREE.MeshStandardMaterial({ map: outerTex, color: 0x9fb878, roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  const lawnTex = grassTexture();
  lawnTex.repeat.set(3, 8);
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2, halfL * 2),
    new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 0.95 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.005;
  lawn.receiveShadow = true;
  scene.add(lawn);

  /* ---- river ---- */
  const waterTex = waterTexture();
  waterTex.repeat.set(8, 1);
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex, roughness: 0.25, metalness: 0.1,
  });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(80, riverHalfW * 2 + 0.6), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.y = 0.012;
  river.receiveShadow = true;
  scene.add(river);

  // river banks
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 1, flatShading: true });
  for (const sz of [1, -1]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.1, 0.25), bankMat);
    bank.position.set(0, 0.03, sz * (riverHalfW + 0.18));
    bank.receiveShadow = true;
    scene.add(bank);
  }

  /* ---- bridges ---- */
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9, flatShading: true });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9, flatShading: true });
  for (const sx of [1, -1]) {
    const bridge = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(bridgeHalfW * 2, 0.1, 0.42), woodMat);
      plank.position.set(0, 0.08, -1.3 + i * 0.52);
      plank.castShadow = plank.receiveShadow = true;
      bridge.add(plank);
    }
    for (const rx of [1, -1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 2.9), woodDark);
      rail.position.set(rx * (bridgeHalfW - 0.05), 0.3, 0);
      rail.castShadow = true;
      bridge.add(rail);
    }
    bridge.position.set(sx * bridgeX, 0, 0);
    scene.add(bridge);
  }

  /* ---- arena border walls (visual) ---- */
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb3bac6, roughness: 0.95, flatShading: true });
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), wallMat);
    m.position.set(x, 0.35, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  };
  mkWall(halfW * 2 + 1.4, 0.6, 0, halfL + 0.5);
  mkWall(halfW * 2 + 1.4, 0.6, 0, -(halfL + 0.5));
  mkWall(0.6, halfL * 2 + 1.4, halfW + 0.5, 0);
  mkWall(0.6, halfL * 2 + 1.4, -(halfW + 0.5), 0);

  /* ---- decorations ---- */
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  for (let i = 0; i < 18; i++) {
    const t = tree(rand(0.8, 1.5));
    // outside the playfield
    const side = Math.random() > 0.5 ? 1 : -1;
    if (Math.random() > 0.45) {
      t.position.set(side * rand(halfW + 2.2, halfW + 9), 0, rand(-halfL - 2, halfL + 2));
    } else {
      t.position.set(rand(-halfW - 6, halfW + 6), 0, side * rand(halfL + 2.2, halfL + 8));
    }
    t.rotation.y = Math.random() * Math.PI * 2;
    scene.add(t);
  }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x96918a, roughness: 1, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.25, 0.6)), rockMat);
    const side = Math.random() > 0.5 ? 1 : -1;
    rock.position.set(side * rand(halfW + 1.5, halfW + 8), 0.15, rand(-halfL - 4, halfL + 4));
    rock.castShadow = true;
    scene.add(rock);
  }

  /* ---- physics: ground, boundary walls, river blockers ---- */
  const fixed = (x: number, y: number, z: number) =>
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(45, 0.5, 60)
      .setCollisionGroups(groups(GROUP.GROUND, GROUP.UNIT | GROUP.FLY)),
    fixed(0, -0.5, 0),
  );

  // boundary walls block everything
  const wallGroups = groups(GROUP.GROUND, GROUP.UNIT | GROUP.FLY);
  world.createCollider(RAPIER.ColliderDesc.cuboid(halfW + 1, 3, 0.4).setCollisionGroups(wallGroups), fixed(0, 1.5, halfL + 0.4));
  world.createCollider(RAPIER.ColliderDesc.cuboid(halfW + 1, 3, 0.4).setCollisionGroups(wallGroups), fixed(0, 1.5, -(halfL + 0.4)));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 3, halfL + 1).setCollisionGroups(wallGroups), fixed(halfW + 0.4, 1.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 3, halfL + 1).setCollisionGroups(wallGroups), fixed(-(halfW + 0.4), 1.5, 0));

  // river blockers (ground units only) — gaps at the bridges
  const blockGroups = groups(GROUP.BLOCK, GROUP.UNIT);
  const inner = bridgeX - bridgeHalfW;       // 3.5
  const outerEdge = bridgeX + bridgeHalfW;   // 6.5
  // center segment
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(inner, 1.2, riverHalfW).setCollisionGroups(blockGroups),
    fixed(0, 0.6, 0),
  );
  // outer segments
  for (const sx of [1, -1]) {
    const hx = (halfW - outerEdge) / 2 + 0.5;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, 1.2, riverHalfW).setCollisionGroups(blockGroups),
      fixed(sx * (outerEdge + hx), 0.6, 0),
    );
  }

  /* ---- animation ---- */
  return {
    update(dt: number) {
      waterTex.offset.x += dt * 0.04;
      waterTex.offset.y = Math.sin(performance.now() * 0.0006) * 0.02;
    },
  };
}
