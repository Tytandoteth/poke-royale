# 🤖 Prompts to improve Poké Royale

This game was built almost entirely with AI coding agents — and you can keep building it the same way. Below is a library of **ready-to-paste prompts**. Clone the repo, open it in an AI coding tool ([Claude Code](https://claude.com/claude-code), Cursor, Windsurf, etc.), and paste one in.

> Made by **[@ty.prompts.ai](https://www.tiktok.com/@ty.prompts.ai)** — follow on TikTok for more AI build-alongs and prompt drops. If you ship something cool with these, tag me. 🙌

**How to use:** each prompt is self-contained and references the real files in this repo, so an agent can act on it directly. Start small (a new card), then go big (a whole new game mode).

---

## 🃏 New cards & creatures

> The engine is data-driven: add an entry to `CARDS` in `src/cards.ts` and a model builder in `src/models.ts`, and the deck builder, AI, and HUD pick it up automatically.

- **Add a new troop:** "Add a new card called **Jolteon** to `src/cards.ts`: a fast, fragile electric glass-cannon (cost 4, ~480 hp, ranged 4.5, electric type, rare rarity, a `bolt` projectile, the trait 'Lightning-fast zapper'). Then build a procedural low-poly model for it in `src/models.ts` following the existing creature builders, and register it in the `BUILDERS` map and `SKIN` table. Keep the art style consistent."

- **Add a spawner building:** "Add a spawner-building card like Clash Royale's Barbarian Hut. Create a `spawner` flag on `UnitStats` in `src/types.ts`, make buildings with it periodically spawn a cheap troop in `src/unit.ts`, and add a 'Pidgey Roost' card that spawns small flyers. Wire it through `game.ts`."

- **Add a win-condition card:** "Add a 'Diglett' card that tunnels under the river — it ignores the bridge pathing in `src/unit.ts` and pops up near the enemy tower. Building-targeting, fast, fragile."

- **Bulk-add a full creature set:** "Add 5 new common-rarity creatures spanning the water, grass, and bug types, each with a distinct procedural model and a unique trait. Follow the patterns already in `src/cards.ts` and `src/models.ts`."

## ⚔️ Gameplay systems

- **Type effectiveness:** "Implement Pokémon-style type effectiveness. Using the `type` field already on every card in `src/cards.ts` and `TYPE_INFO` in `src/types.ts`, make attacks deal 1.4× to types they're strong against and 0.6× to types they resist (water→fire/rock, fire→grass/ice, electric→water/flying, grass→water/rock, etc.). Apply it in `takeDamage`/damage paths in `src/unit.ts` and `src/projectile.ts`, and show a 'super effective!' floating note via `src/damageNumbers.ts`."

- **Card levels:** "Add card levels (1–11) that scale hp/dmg ~8% per level, stored in `localStorage` alongside the progression in `src/progression.ts`. Show level on each card and let players spend a currency earned from wins to upgrade in the deck builder."

- **Evolutions (in the roadmap):** "Add Clash-Royale-style Evolutions: pick 1–2 evo slots in the deck builder; a card charges up over the match, and its next deploy uses buffed stats + a special trait (Evo Pikachu = chain lightning; Evo Eevee = each spawns with a one-hit shield). Add the charge meter UI to `src/ui.ts`."

- **Champion hero:** "Add a high-cost Champion card (Charizard) with a manually-activated ability. While it's alive, show an ability button in the HUD (`src/ui.ts`); pressing it triggers 'Blast Burn', an AoE fire nova around the champion (logic in `src/unit.ts`, FX in `src/effects.ts`)."

- **New mode — Draft:** "Add a Draft mode: instead of the deck builder, present the player 8 random choose-1-of-2 picks before the match. Add a mode selector to the home screen in `src/screens/home.ts`."

## 🎨 Graphics & visual polish

- **Two-tone bodies:** "Give creatures richer color: add belly/marking colors and subtle gradient shading to the procedural models in `src/models.ts` so each creature reads as two-tone instead of a single flat color."

- **Better ground & water:** "Upgrade the arena in `src/arena.ts`: add a normal map to the grass for subtle relief, animated caustics/foam to the river, and scattered flowers/pebbles. Keep it performant."

- **Weather & time of day:** "Add a day/night cycle and optional rain to `src/arena.ts` and the lighting in `src/game.ts`, selectable in Settings. Rain should add particle FX and a wet sheen."

- **Deploy & death juice:** "Add a deploy 'summon' ring animation and a more dramatic death dissolve to `src/unit.ts` and `src/effects.ts`."

## 🖥️ UI / UX

- **Card codex screen:** "Add a 'Collection' screen reachable from the home screen (`src/screens/`) that shows all 15 cards with full stats, type, rarity, and trait — a browsable codex."

- **Animated card hand:** "Make the in-match hand cards (`src/ui.ts`) animate in with a stagger, and add a satisfying 'card slides up and dissolves' animation when a card is played."

- **Emote wheel:** "Add a quick emote wheel during matches (taunt, thumbs-up, 'oops') with floating emoji over the player's king tower."

## 🧠 AI

- **Harder AI:** "Add a 4th 'Grandmaster' difficulty to `src/ai.ts` that counts the player's elixir, predicts pushes, and pre-places defenders. Tune the `DIFF` table."

- **Personality decks:** "Give the AI named opponents, each with a themed deck and play style (beatdown, control, spam-cycle), chosen on the home screen."

## 🔊 Audio

- **Music tracks:** "Add 2–3 alternate synthesized music tracks to `src/audio.ts` (a calm menu theme, an intense double-elixir theme) and crossfade between them based on match state."

## 🌟 Make it your own

- **Re-theme it:** "Swap the creatures for original critters: change the names, emoji, colors, and types in `src/cards.ts` so this becomes a clean, original-IP RTS template. The engine doesn't depend on any of the names."

- **New arena:** "Create a second arena theme (lava, ice, or space) as a variant of `src/arena.ts`, selectable on the home screen."

---

Built something with these? Show it off and tag **[@ty.prompts.ai](https://www.tiktok.com/@ty.prompts.ai)** on TikTok. ⚡
