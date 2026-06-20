import * as THREE from 'three';

interface FloatingNumber {
  el: HTMLDivElement;
  world: THREE.Vector3;
  life: number;
  maxLife: number;
}

const _v = new THREE.Vector3();

/** DOM-based floating damage numbers projected from world space — crisp at any zoom. */
export class DamageNumbers {
  private container: HTMLDivElement;
  private active: FloatingNumber[] = [];

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'dmg-layer';
    document.body.appendChild(this.container);
  }

  spawn(world: THREE.Vector3, amount: number, kind: 'enemy' | 'friendly' | 'heal') {
    if (this.active.length > 48) return;
    const el = document.createElement('div');
    el.className = `dmg dmg-${kind}`;
    el.textContent = String(Math.max(1, Math.round(amount)));
    // bigger hits read bigger
    el.style.fontSize = `${Math.round(13 + Math.min(15, amount / 22))}px`;
    this.container.appendChild(el);
    this.active.push({
      el,
      world: world.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, 0)),
      life: 0.8,
      maxLife: 0.8,
    });
  }

  /** Floating text label, e.g. "SUPER!" on a super-effective hit. */
  spawnLabel(world: THREE.Vector3, text: string, kind: 'super' | 'resist') {
    if (this.active.length > 48) return;
    const el = document.createElement('div');
    el.className = `dmg dmg-${kind}`;
    el.textContent = text;
    this.container.appendChild(el);
    this.active.push({
      el,
      world: world.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.55, 0)),
      life: 1.0,
      maxLife: 1.0,
    });
  }

  update(dt: number, camera: THREE.Camera) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i];
      n.life -= dt;
      if (n.life <= 0) {
        n.el.remove();
        this.active.splice(i, 1);
        continue;
      }
      n.world.y += dt * 1.4;
      _v.copy(n.world).project(camera);
      if (_v.z > 1) { n.el.style.opacity = '0'; continue; }
      const frac = n.life / n.maxLife;
      n.el.style.transform = `translate(-50%, -50%) translate(${((_v.x + 1) / 2) * innerWidth}px, ${((-_v.y + 1) / 2) * innerHeight}px) scale(${0.7 + 0.3 * frac})`;
      n.el.style.opacity = String(Math.min(1, frac * 2));
    }
  }
}
