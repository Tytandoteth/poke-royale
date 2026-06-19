import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA, MATCH, TEAM_COLOR, distXZ } from './types';
import type { Combatant, ProjectileSpec, UnitStats } from './types';
import { Deck, DECK_IDS, randomDeck } from './cards';
import { buildArena } from './arena';
import type { ArenaHandle } from './arena';
import { Unit } from './unit';
import { Tower } from './tower';
import { Projectile } from './projectile';
import { Effects } from './effects';
import { UI } from './ui';
import { AiController } from './ai';
import type { Difficulty } from './ai';
import { CameraRig } from './cameraControls';
import { GameAudio } from './audio';
import { DamageNumbers } from './damageNumbers';
import { DebrisField } from './debris';
import { SettingsScreen } from './screens/settings';

const DT = 1 / 60;
const _pos = new THREE.Vector3();

export class Game {
  container: HTMLElement;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  world!: RAPIER.World;
  rig!: CameraRig;
  ui!: UI;
  ai!: AiController;
  effects = new Effects(this.scene);
  audio = new GameAudio();
  dmgNums = new DamageNumbers();
  debris!: DebrisField;
  arena!: ArenaHandle;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  onMatchEnd: ((result: 'win' | 'lose' | 'draw', crowns: [number, number]) => void) | null = null;
  private timeScale = 1;
  private introT = 0;
  private introStage = -1;
  private cinematic: { t: number; focus: THREE.Vector3; result: 'win' | 'lose' } | null = null;

  units: Unit[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];

  playerDeck = new Deck(DECK_IDS);
  playerElixir = MATCH.startElixir;
  time = 0;
  crowns: [number, number] = [0, 0];
  over = false;
  suddenDeath = false;
  matchStarted = false;
  difficulty: Difficulty = 'normal';

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ghost!: THREE.Group;
  private ghostRing!: THREE.Mesh;
  private deployZone!: THREE.Mesh;
  private accumulator = 0;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
  }

  async start() {
    (window as unknown as { game: Game }).game = this;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = DT;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // bloom pipeline: crystals, projectiles, flames and lightning glow
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });

    // unlock audio on first interaction; M toggles mute
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        this.ui.showBanner(this.audio.toggleMute() ? '🔇 Muted' : '🔊 Sound on');
      }
    });

    this.arena = buildArena(this.scene, this.world);
    this.debris = new DebrisField(this);
    this.rig = new CameraRig(this.camera, this.renderer.domElement);

    // towers: 3 per side
    const { princess, king } = ARENA;
    this.towers.push(
      new Tower(this, 0, 'princess', princess.x, princess.z),
      new Tower(this, 0, 'princess', -princess.x, princess.z),
      new Tower(this, 0, 'king', 0, king.z),
      new Tower(this, 1, 'princess', princess.x, -princess.z),
      new Tower(this, 1, 'princess', -princess.x, -princess.z),
      new Tower(this, 1, 'king', 0, -king.z),
    );

    this.buildGhost();
    this.ai = new AiController(this, randomDeck(), this.difficulty);

    this.ui = new UI({
      onPreview: (i, x, y) => this.showPreview(i, x, y),
      onPreviewEnd: () => this.hidePreview(),
      onDeploy: (i, x, y) => this.deployFromHand(i, x, y),
      onDragStateChange: (dragging) => {
        this.rig.panBlocked = dragging;
        if (dragging) this.rig.cancelPan();
        this.deployZone.visible = dragging;
      },
      onToggleMute: () => this.audio.toggleMute(),
      onOpenSettings: () => new SettingsScreen(this).show(),
    });

    this.lastTime = performance.now();
    this.loop();
  }

  /** Called by the deck builder once the player locks in 8 cards. */
  beginMatch(ids: string[], difficulty: Difficulty = this.difficulty) {
    this.difficulty = difficulty;
    this.playerDeck = new Deck(ids);
    this.ai = new AiController(this, randomDeck(), difficulty);
    this.playerElixir = MATCH.startElixir;
    this.matchStarted = true;
    this.introT = 3.4; // 3…2…1…Battle!
    this.introStage = -1;
    this.audio.unlock();
  }

  /** Graphics quality preset — pixel ratio, shadows, bloom. */
  setQuality(q: 'low' | 'medium' | 'high') {
    const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.bloom.enabled = q !== 'low';
    this.bloom.strength = q === 'high' ? 0.55 : 0.4;
    this.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight && l.shadow) l.castShadow = q !== 'low';
    });
  }

  /* ------------------------------------------------------------ */

  private buildGhost() {
    this.ghost = new THREE.Group();
    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 28),
      new THREE.MeshBasicMaterial({ color: 0x4dff6a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.position.y = 0.06;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.3, 2.2, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    beam.position.y = 1.1;
    this.ghost.add(this.ghostRing, beam);
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    // player's deploy half highlight
    const zoneLen = ARENA.halfL - ARENA.riverHalfW - 0.4;
    this.deployZone = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfW * 2, zoneLen),
      new THREE.MeshBasicMaterial({ color: TEAM_COLOR[0], transparent: true, opacity: 0.1, depthWrite: false }),
    );
    this.deployZone.rotation.x = -Math.PI / 2;
    this.deployZone.position.set(0, 0.03, ARENA.riverHalfW + 0.4 + zoneLen / 2);
    this.deployZone.visible = false;
    this.scene.add(this.deployZone);
  }

  private screenToGround(clientX: number, clientY: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2(
      (clientX / innerWidth) * 2 - 1,
      -(clientY / innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, out) ? out : null;
  }

  private isValidDeploy(p: THREE.Vector3, card?: UnitStats): boolean {
    if (Math.abs(p.x) > ARENA.halfW - 0.5) return false;
    if (p.z < -ARENA.halfL + 0.6 || p.z > ARENA.halfL - 0.6) return false;
    if (card?.spell) return true; // spells go anywhere
    if (p.z >= ARENA.riverHalfW + 0.4) return true;
    // destroyed enemy princess tower opens up that side of their half
    const openSide = (sx: number) =>
      this.towers.some((t) => t.team === 1 && t.kind === 'princess' && !t.alive && Math.sign(t.pos.x) === sx);
    if (p.z >= -7.5 && p.x >= 0 && openSide(1)) return true;
    if (p.z >= -7.5 && p.x < 0 && openSide(-1)) return true;
    return false;
  }

  private showPreview(i: number, x: number, y: number) {
    const p = this.screenToGround(x, y);
    if (!p) { this.ghost.visible = false; return; }
    this.ghost.visible = true;
    this.ghost.position.set(p.x, 0, p.z);
    (this.ghostRing.material as THREE.MeshBasicMaterial).color.set(
      this.isValidDeploy(p, this.playerDeck.hand[i]) ? 0x4dff6a : 0xff5252,
    );
  }

  private hidePreview() {
    this.ghost.visible = false;
  }

  private deployFromHand(i: number, x: number, y: number): boolean {
    if (this.over) return false;
    const card = this.playerDeck.hand[i];
    const p = this.screenToGround(x, y);
    if (!p || !this.isValidDeploy(p, card)) return false;
    if (card.cost > this.playerElixir) return false;
    this.playerElixir -= card.cost;
    this.playerDeck.play(i);
    if (card.spell) this.castSpell(0, card, p);
    else this.spawnUnits(0, card, p);
    return true;
  }

  castSpell(team: number, card: UnitStats, pos: THREE.Vector3) {
    const spell = card.spell;
    if (!spell) return;
    if (spell.kind === 'thunder') {
      this.effects.lightning(pos);
      this.audio.thunder();
      this.rig.shake(0.45);
    } else if (spell.kind === 'fire') {
      this.effects.fireBlast(pos);
      this.audio.fire();
      this.rig.shake(0.3);
    } else {
      this.effects.iceBlast(pos);
      this.audio.freezeSfx();
    }
    this.areaDamage(team, pos, spell.radius, card.dmg, spell.towerDmgFactor);
    // secondary effects on survivors
    const kb = new THREE.Vector3();
    for (const u of this.units) {
      if (u.team === team || !u.alive) continue;
      u.getPosition(_pos);
      if (distXZ(_pos, pos) - u.radius > spell.radius) continue;
      if (spell.kind === 'freeze' && spell.freezeDur) u.freeze(spell.freezeDur);
      if (spell.knockback && !u.isBuilding) {
        kb.subVectors(_pos, pos).setY(0).normalize();
        const m = u.body.mass();
        u.body.applyImpulse({ x: kb.x * m * 5, y: m * 2.5, z: kb.z * m * 5 }, true);
      }
    }
    if (spell.kind === 'freeze' && spell.freezeDur) {
      for (const t of this.towers) {
        if (t.team === team || !t.alive) continue;
        if (distXZ(t.pos, pos) - t.radius <= spell.radius) t.frozenT = spell.freezeDur * 0.5;
      }
    }
  }

  spawnUnits(team: number, stats: UnitStats, pos: THREE.Vector3) {
    const offsets =
      stats.count === 1
        ? [[0, 0]]
        : stats.count === 3
          ? [[0, 0.7], [-0.65, -0.4], [0.65, -0.4]]
          : Array.from({ length: stats.count }, (_, k) => [
              Math.cos((k / stats.count) * Math.PI * 2) * 0.7,
              Math.sin((k / stats.count) * Math.PI * 2) * 0.7,
            ]);
    for (const [ox, oz] of offsets) {
      const p = new THREE.Vector3(
        THREE.MathUtils.clamp(pos.x + ox, -ARENA.halfW + 0.6, ARENA.halfW - 0.6),
        0,
        THREE.MathUtils.clamp(pos.z + oz, -ARENA.halfL + 0.6, ARENA.halfL - 0.6),
      );
      this.units.push(new Unit(this, stats, team, p));
      this.effects.burst(p.clone().setY(0.5), TEAM_COLOR[team], 10, 3.5, 0.2, 0.4);
    }
    this.audio.pop();
  }

  spawnProjectile(from: THREE.Vector3, target: Combatant, spec: ProjectileSpec, dmg: number, team: number) {
    this.projectiles.push(new Projectile(this, from, target, spec, dmg, team));
  }

  /* ------------------------------------------------------------ */

  allCombatants(): Combatant[] {
    return [...this.units, ...this.towers];
  }

  /**
   * Best enemy unit within aggro range (prefer one already in attack range, then
   * nearest, with a mild low-HP bias for focus fire), else nearest enemy tower.
   */
  findTarget(unit: Unit): Combatant | null {
    unit.getPosition(_pos);
    let bestUnit: Combatant | null = null;
    let bestScore = Infinity;
    for (const u of this.units) {
      if (u.team === unit.team || !u.alive) continue;
      // building-seekers ignore everything except structures (Snorlax taunts them)
      if (unit.stats.buildingOnly && !u.isBuilding) continue;
      if (u.flying && !unit.stats.targetsAir) continue;
      const d = distXZ(_pos, u.getPosition(new THREE.Vector3())) - u.radius;
      if (d > unit.stats.aggro) continue;
      let score = d;
      if (d <= unit.stats.range) score -= unit.stats.aggro; // strongly prefer in-range
      score += u.hp / 4000; // mild focus-fire on weaker targets
      if (score < bestScore) {
        bestScore = score;
        bestUnit = u;
      }
    }
    if (bestUnit) return bestUnit;

    let bestTower: Combatant | null = null;
    let bestTowerD = Infinity;
    for (const t of this.towers) {
      if (t.team === unit.team || !t.alive) continue;
      const d = distXZ(_pos, t.pos);
      if (d < bestTowerD) {
        bestTowerD = d;
        bestTower = t;
      }
    }
    return bestTower;
  }

  areaDamage(team: number, pos: THREE.Vector3, radius: number, dmg: number, towerDmgFactor = 1) {
    const dir = new THREE.Vector3();
    for (const c of this.allCombatants()) {
      if (c.team === team || !c.alive) continue;
      c.getPosition(_pos);
      if (distXZ(_pos, pos) - c.radius <= radius) {
        dir.subVectors(_pos, pos).setY(0).normalize();
        c.takeDamage(c.isBuilding ? dmg * towerDmgFactor : dmg, dir.clone());
      }
    }
  }

  onTowerDestroyed(tower: Tower) {
    const winnerTeam = 1 - tower.team;
    this.crowns[winnerTeam]++;
    this.audio.boom();
    this.rig.shake(0.6);
    this.ui.showBanner(winnerTeam === 0 ? 'Enemy tower destroyed!' : 'Your tower was destroyed!');
    // king activates when a princess tower falls
    if (tower.kind === 'princess') {
      const king = this.towers.find((t) => t.team === tower.team && t.kind === 'king');
      king?.activate();
    }
    if (tower.kind === 'king') {
      // slow-mo death cinematic, then the result screen
      if (!this.over && !this.cinematic) {
        this.cinematic = { t: 1.5, focus: tower.pos.clone(), result: winnerTeam === 0 ? 'win' : 'lose' };
        this.timeScale = 0.2;
        this.rig.panBlocked = true;
      }
    } else if (this.suddenDeath) {
      this.endMatch(winnerTeam === 0 ? 'win' : 'lose');
    }
  }

  private endMatch(result: 'win' | 'lose' | 'draw') {
    if (this.over) return;
    this.over = true;
    this.audio.fanfare(result === 'win');
    if (this.onMatchEnd) this.onMatchEnd(result, this.crowns);
    else this.ui.showEnd(result, this.crowns);
  }

  /* ------------------------------------------------------------ */

  private loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    frameDt = Math.min(frameDt, 0.1); // tab-switch guard

    // king-kill cinematic: slow time, push the camera in (runs on real time)
    if (this.cinematic) {
      const c = this.cinematic;
      c.t -= frameDt;
      this.rig.target.lerp(c.focus, Math.min(1, frameDt * 5));
      this.rig.dist += (13 - this.rig.dist) * Math.min(1, frameDt * 4);
      this.rig.polar += (0.95 - this.rig.polar) * Math.min(1, frameDt * 4);
      if (c.t <= 0) {
        this.timeScale = 1;
        this.rig.panBlocked = false;
        this.cinematic = null;
        this.endMatch(c.result);
      }
    }

    this.accumulator += frameDt * this.timeScale;
    while (this.accumulator >= DT) {
      this.step(DT);
      this.accumulator -= DT;
    }

    this.arena.update(frameDt);
    this.effects.update(frameDt);
    this.debris.update(frameDt);
    this.dmgNums.update(frameDt, this.camera);
    this.rig.update(frameDt);
    this.composer.render();
  };

  private step(dt: number) {
    // deck-builder is open: idle world
    if (!this.matchStarted) {
      this.world.step();
      for (const t of this.towers) t.update(dt);
      return;
    }
    // intro countdown: world is alive but the match hasn't started
    if (this.introT > 0) {
      this.introT -= dt;
      const stage = Math.ceil(Math.max(0, this.introT - 0.4));
      if (stage !== this.introStage) {
        this.introStage = stage;
        this.ui.showBanner(stage > 0 ? String(stage) : '⚔️ Battle!');
        this.audio.beep(stage === 0);
      }
      this.world.step();
      for (const t of this.towers) t.update(dt);
      return;
    }
    if (!this.over) {
      this.time += dt;

      // elixir
      const rate = MATCH.elixirRate * (this.time > MATCH.doubleElixirAt ? 2 : 1);
      this.playerElixir = Math.min(MATCH.maxElixir, this.playerElixir + rate * dt);
      this.ai.update(dt, rate);

      // match clock
      if (!this.suddenDeath && this.time >= MATCH.duration) {
        if (this.crowns[0] !== this.crowns[1]) {
          this.endMatch(this.crowns[0] > this.crowns[1] ? 'win' : 'lose');
        } else {
          this.suddenDeath = true;
          this.ui.showBanner('Sudden death! First tower wins!');
        }
      }
      if (this.suddenDeath && this.time >= MATCH.duration + MATCH.suddenDeathMax) {
        this.endMatch('draw');
      }
    }

    // physics + entities
    this.world.step();
    for (const u of this.units) u.update(dt);
    for (const t of this.towers) t.update(dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(dt)) {
        this.projectiles[i].dispose();
        this.projectiles.splice(i, 1);
      }
    }
    // reap finished ragdolls
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!u.alive && u.deadT <= 0) {
        u.dispose();
        this.units.splice(i, 1);
      }
    }

    // HUD
    const timeLeft = this.suddenDeath
      ? MATCH.duration + MATCH.suddenDeathMax - this.time
      : MATCH.duration - this.time;
    this.ui.refresh({
      elixir: this.playerElixir,
      maxElixir: MATCH.maxElixir,
      hand: this.playerDeck.hand,
      next: this.playerDeck.next(),
      timeLeft,
      overtime: this.suddenDeath,
      crowns: this.crowns,
    });
  }
}
