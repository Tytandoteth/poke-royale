import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP, groups } from './types';
import type { Game } from './game';

interface Chunk {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  life: number;
}

/** Physically simulated rubble chunks for tower destruction. */
export class DebrisField {
  private game: Game;
  private chunks: Chunk[] = [];

  constructor(game: Game) {
    this.game = game;
  }

  explode(pos: THREE.Vector3, colors: number[], count = 14) {
    for (let i = 0; i < count; i++) {
      const size = 0.14 + Math.random() * 0.24;
      const x = pos.x + (Math.random() - 0.5) * 1.6;
      const z = pos.z + (Math.random() - 0.5) * 1.6;
      const y = 0.5 + Math.random() * 2.6;

      const body = this.game.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.2),
      );
      this.game.world.createCollider(
        RAPIER.ColliderDesc.cuboid(size * 0.7, size * 0.7, size * 0.7)
          .setRestitution(0.35)
          .setFriction(0.8)
          // debris only collides with the ground so it can't shove armies around
          .setCollisionGroups(groups(GROUP.BLOCK, GROUP.GROUND)),
        body,
      );
      const m = body.mass();
      const a = Math.random() * Math.PI * 2;
      const power = 3 + Math.random() * 5;
      body.applyImpulse({ x: Math.cos(a) * m * power, y: m * (4 + Math.random() * 5), z: Math.sin(a) * m * power }, true);
      body.applyTorqueImpulse(
        { x: (Math.random() - 0.5) * m * 2, y: (Math.random() - 0.5) * m * 2, z: (Math.random() - 0.5) * m * 2 },
        true,
      );

      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size),
        new THREE.MeshStandardMaterial({
          color: colors[i % colors.length],
          roughness: 0.95,
          flatShading: true,
        }),
      );
      mesh.castShadow = true;
      this.game.scene.add(mesh);
      this.chunks.push({ body, mesh, life: 2.6 + Math.random() });
    }
  }

  update(dt: number) {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.game.world.removeRigidBody(c.body);
        this.game.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        (c.mesh.material as THREE.Material).dispose();
        this.chunks.splice(i, 1);
        continue;
      }
      const t = c.body.translation();
      const r = c.body.rotation();
      c.mesh.position.set(t.x, t.y, t.z);
      c.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (c.life < 0.5) {
        const mat = c.mesh.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = c.life / 0.5;
      }
    }
  }
}
