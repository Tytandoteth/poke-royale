# Poké Royale ⚡👑

A Clash Royale–style real-time strategy game with Pokémon-inspired creatures, rendered as a fully **3D battlefield you can zoom into**, with real physics — built with Three.js and the Rapier physics engine.

![genre](https://img.shields.io/badge/genre-RTS%20card%20battler-purple)
![stack](https://img.shields.io/badge/stack-Three.js%20%2B%20Rapier%20%2B%20Vite-blue)

## Play

```bash
npm install
npm run dev      # → http://localhost:5173
```

- **Drag a card** from your hand onto your half of the arena to deploy
- **Mouse wheel** — zoom right down into the battle
- **Right-drag** — orbit the camera · **Left-drag** — pan · **R** — reset view · **M** — mute
- Destroy more towers than the enemy in 3 minutes. Take the King Tower for an instant win. Last 60 seconds: **double elixir**. Tied at the horn? **Sudden death.**

## The deck

| Card | Cost | Role |
|------|------|------|
| ⚡ Pikachu | 3 | Fast ranged zapper, hits air |
| 🔥 Charizard | 5 | Flying splash damage |
| 💧 Squirtle | 2 | Cheap ranged chip |
| 🌿 Bulbasaur | 3 | Sturdy ranged, ground only |
| 👊 Machamp | 5 | Heavy melee bruiser |
| 🪨 Golem | 6 | Tower-only tank |
| 👻 Gengar | 4 | Fast melee assassin |
| 🦊 Eevee Pack | 2 | Three-unit swarm |
| 🌩️ Thunder | 4 | Area damage spell, anywhere |

## How it works

- **Rendering** — Three.js with PCF soft shadows, ACES tone mapping, and an UnrealBloom pipeline. Every creature is a procedural low-poly model built from primitives at runtime (`src/models.ts`) — no asset downloads.
- **Physics** — Rapier (WASM). Units are dynamic rigid bodies: they collide, shove each other, take knockback impulses, and **ragdoll** when they die. The river physically blocks ground units everywhere except the bridges; flying units soar over it.
- **Simulation** — fixed 60 Hz step with an accumulator; rendering is uncapped.
- **Audio** — all SFX synthesized live with WebAudio oscillators/noise. Zero audio files.
- **AI** — elixir-fair opponent that defends threats, thunders your clusters, and builds back-lane pushes.

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | dev server with HMR |
| `npm run build` | type-check + production bundle |
| `npm run preview` | serve the production build |

> Fan-made tech demo for personal/educational use. Pokémon and the names of its characters are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.; this project is not affiliated with or endorsed by them and uses no extracted game assets.
