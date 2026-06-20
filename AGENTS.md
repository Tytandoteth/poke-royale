# AGENTS.md

Guidance for AI coding agents (Cursor, Claude Code, Codex, Zed, Windsurf, etc.) working in this repo. Humans: see [README.md](README.md). For copy-paste feature prompts, see [PROMPTS.md](PROMPTS.md).

## What this is

Poké Royale — a Clash Royale–style 3D real-time strategy game. **No game engine, no art/audio assets:** every creature, tower, effect, and sound is generated procedurally in code with [Three.js](https://threejs.org) (rendering) and [Rapier](https://rapier.rs) (WASM physics). TypeScript + Vite. Runs 100% client-side in the browser.

## Setup & commands

```bash
npm install        # install deps
npm run dev        # Vite dev server with HMR (http://localhost:5173)
npm run build      # type-check (tsc --noEmit) + production bundle to dist/
npm run preview    # serve the production build
```

There are **no environment variables, API keys, or backend** — it runs entirely in the browser. Node 18+.

**Always run `npm run build` before considering a change done** — it type-checks the whole project. There is no separate lint/test suite; the type checker plus a manual run in the browser is the verification loop.

## Architecture (where things live)

The simulation is a fixed 60 Hz step with an accumulator (`game.ts`); rendering is uncapped. `Game` (`src/game.ts`) is the orchestrator that owns the scene, physics world, entities, camera, and match loop.

```
src/
  main.ts          entry + screen flow: Home → DeckBuilder → Match → End
  game.ts          orchestrator: scene, physics, match loop, targeting, damage
  types.ts         shared types + constants (ARENA, MATCH), type chart, rarity/type tables
  cards.ts         all 15 card definitions (CARDS) + Deck logic — DATA-DRIVEN
  models.ts        procedural 3D creature + tower meshes; SKIN/bump-texture system
  unit.ts          creature behavior: movement/pathing, combat, melee styles, ragdoll
  tower.ts         tower behavior + king activation
  projectile.ts    per-style ranged projectile visuals (bolt/bubble/leaf/fireball)
  ai.ts            AI opponent: threat scoring, counter-picking, difficulty tiers
  arena.ts         environment: ground, river, bridges, lighting, crowd stands
  effects.ts       particle bursts, HP bars, spell FX
  damageNumbers.ts floating damage numbers + "SUPER!" labels (DOM, projected)
  debris.ts        physical tower-rubble chunks
  audio.ts         synthesized WebAudio SFX + music (no audio files)
  progression.ts   trophies / king level / XP (localStorage)
  settings.ts      audio + graphics settings (localStorage)
  cameraControls.ts  zoom/orbit/pan + pinch
  ui.ts            in-match HUD
  deckBuilder.ts   pre-match 8-of-15 deck picker
  screens/         home + settings overlays
```

## Key conventions

- **Data-driven content.** Adding a card means an entry in `CARDS` (`src/cards.ts`) + a model builder in `src/models.ts` (registered in `BUILDERS`). The deck builder, AI, HUD, and balance all read from `CARDS` automatically — don't hardcode card lists elsewhere.
- **No assets.** Keep it that way unless explicitly asked. Models are primitives in `models.ts`; textures are canvas-generated; audio is synthesized in `audio.ts`. Don't add image/audio/model files.
- **TypeScript strict.** No `any` unless unavoidable. Match the existing terse, comment-light-but-purposeful style.
- **Damage goes through `Game.applyTypedDamage`** so elemental type effectiveness (`typeMultiplier` in `types.ts`) is always applied. Don't call `takeDamage` directly from new attack code.
- **Physics collision groups** live in `types.ts` (`GROUP`, `groups()`). Ground units are blocked by the river except at bridges; flyers ignore it. Bridges and princess towers share the `x = ±ARENA.bridgeX` lane — unit pathing in `unit.ts` (`waypoint`/`avoidTowers`) handles steering around towers.
- **`window.game`** is exposed in dev for console debugging/inspection.

## How to verify a change

1. `npm run build` — must pass clean (type-checks everything).
2. `npm run dev` and play a match in the browser. The game auto-flows Home → deck → battle.
3. For gameplay logic, you can drive it from the devtools console via `window.game` (e.g. `window.game.spawnUnits(0, CARDS.pikachu, {x:0,y:0,z:5})`).

## Gotchas

- The match loop early-returns during the intro countdown and when `!matchStarted`; entity updates only run during live play.
- `Game.timeScale` scales the sim (used for the slow-mo king-kill cinematic); leave it at 1 outside cinematics.
- Camera distances/angles are clamped in `cameraControls.ts`.
- Procedural models smooth-shade organic creatures (`SKIN` table in `models.ts`); rocky things keep flat shading.

## Scope / legal

This is a non-commercial fan project. The Pokémon names are trademarks of Nintendo/Creatures/GAME FREAK — see [NOTICE.md](NOTICE.md). If asked to make it publishable as original IP, re-theme the names/emoji/colors/types in `src/cards.ts`; the engine is generic and doesn't depend on them.
