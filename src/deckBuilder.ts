import { ALL_CARD_IDS, CARDS, DECK_IDS } from './cards';
import { RARITY_COLOR, RARITY_LABEL } from './types';

const STORAGE_KEY = 'poke-royale-deck';

function savedDeck(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '');
    if (Array.isArray(s) && s.length === 8 && s.every((id) => CARDS[id])) return s;
  } catch { /* fall through */ }
  return [...DECK_IDS];
}

/** Pre-match overlay: pick exactly 8 of all cards. Selection persists. */
export class DeckBuilder {
  show(onStart: (ids: string[]) => void) {
    const selected = new Set(savedDeck());

    const overlay = document.createElement('div');
    overlay.id = 'deckbuilder';
    overlay.innerHTML = `
      <div class="db-head">
        <span class="eyebrow">POKÉ ROYALE</span>
        <h1>Build Your Deck</h1>
      </div>
      <div id="db-dock">${'<div class="db-slot"></div>'.repeat(8)}</div>
      <div id="db-stats">
        <span><b id="db-avg">0.0</b> avg elixir</span>
        <span id="db-count"></span>
      </div>
      <div id="db-grid"></div>
      <button id="db-start" class="btn-gold">⚔️ Battle!</button>`;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector('#db-grid')!;
    const count = overlay.querySelector('#db-count') as HTMLElement;
    const avg = overlay.querySelector('#db-avg') as HTMLElement;
    const slots = [...overlay.querySelectorAll('.db-slot')] as HTMLElement[];
    const startBtn = overlay.querySelector('#db-start') as HTMLButtonElement;

    const refresh = () => {
      count.textContent = `${selected.size} / 8 cards`;
      count.classList.toggle('ready', selected.size === 8);
      startBtn.disabled = selected.size !== 8;
      const picked = [...selected];
      slots.forEach((slot, i) => {
        const id = picked[i];
        slot.textContent = id ? CARDS[id].emoji : '';
        slot.classList.toggle('filled', !!id);
      });
      const costs = picked.map((id) => CARDS[id].cost);
      avg.textContent = costs.length
        ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(1)
        : '0.0';
      grid.querySelectorAll('.db-card').forEach((el) => {
        el.classList.toggle('picked', selected.has((el as HTMLElement).dataset.id!));
      });
    };

    for (const id of ALL_CARD_IDS) {
      const card = CARDS[id];
      const el = document.createElement('div');
      el.className = 'db-card';
      el.dataset.id = id;
      el.style.background = `linear-gradient(160deg, ${card.uiColor} 0%, #1c2240 135%)`;
      el.style.setProperty('--rar', RARITY_COLOR[card.rarity]);
      el.title = card.trait;
      el.innerHTML = `
        <span class="rar-bar"></span>
        <span class="cost">${card.cost}</span>
        <span class="emoji">${card.emoji}</span>
        <span class="name">${card.name}</span>
        <span class="rarity">${RARITY_LABEL[card.rarity]}</span>`;
      el.addEventListener('click', () => {
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < 8) selected.add(id);
        refresh();
      });
      grid.appendChild(el);
    }
    refresh();

    startBtn.addEventListener('click', () => {
      const ids = [...selected];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 350);
      onStart(ids);
    });
  }
}
