import * as THREE from 'three';

const DEFAULT = { dist: 30, az: 0, polar: 0.62, target: new THREE.Vector3(0, 0, 1.5) };

/**
 * Clash-Royale-style camera with free zoom/orbit/pan:
 *  - wheel / pinch: zoom (get close to the battlefield)
 *  - right- or middle-drag: orbit
 *  - left-drag on the field: pan (disabled while dragging a card)
 *  - R / double-right-click: reset
 */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  target = DEFAULT.target.clone();
  dist = DEFAULT.dist;
  az = DEFAULT.az;
  polar = DEFAULT.polar;
  panBlocked = false;
  private shakeT = 0;

  private dragMode: 'none' | 'orbit' | 'pan' | 'pinch' = 'none';
  private lastX = 0;
  private lastY = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist *= 1 + e.deltaY * 0.0012;
      this.dist = THREE.MathUtils.clamp(this.dist, 6, 42);
    }, { passive: false });

    dom.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // two fingers → pinch zoom
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.dragMode = 'pinch';
        return;
      }
      if (e.button === 2 || e.button === 1) {
        this.dragMode = 'orbit';
      } else if (e.button === 0 && !this.panBlocked) {
        this.dragMode = 'pan';
      } else {
        return;
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (this.dragMode === 'none') return;
      if (this.dragMode === 'pinch') {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 1 && this.pinchDist > 1) {
          this.dist = THREE.MathUtils.clamp(this.dist * (this.pinchDist / d), 6, 42);
        }
        this.pinchDist = d;
        return;
      }
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      if (this.dragMode === 'orbit') {
        this.az -= dx * 0.005;
        this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.004, 0.18, 1.35);
      } else {
        // pan in camera-aligned ground plane
        const k = this.dist * 0.0011;
        const right = new THREE.Vector3(Math.cos(this.az), 0, -Math.sin(this.az));
        const fwd = new THREE.Vector3(-Math.sin(this.az), 0, -Math.cos(this.az));
        this.target.addScaledVector(right, -dx * k);
        this.target.addScaledVector(fwd, dy * k);
        this.target.x = THREE.MathUtils.clamp(this.target.x, -11, 11);
        this.target.z = THREE.MathUtils.clamp(this.target.z, -15, 15);
      }
    });

    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.dragMode === 'pinch' && this.pointers.size < 2) this.dragMode = 'none';
      else if (this.dragMode !== 'pinch') this.dragMode = 'none';
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.reset();
    });
    dom.addEventListener('dblclick', () => this.reset());
  }

  reset() {
    this.target.copy(DEFAULT.target);
    this.dist = DEFAULT.dist;
    this.az = DEFAULT.az;
    this.polar = DEFAULT.polar;
  }

  cancelPan() {
    if (this.dragMode === 'pan') this.dragMode = 'none';
  }

  shake(amount = 0.3) {
    this.shakeT = Math.max(this.shakeT, amount);
  }

  update(dt = 1 / 60) {
    const sp = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.dist * sp * Math.sin(this.az),
      this.target.y + this.dist * Math.cos(this.polar),
      this.target.z + this.dist * sp * Math.cos(this.az),
    );
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const s = this.shakeT * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.target);
  }
}
