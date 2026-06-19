import { loadSettings, saveSettings, applySettings } from '../settings';
import type { Quality } from '../settings';
import type { Game } from '../game';

const QUALITIES: { id: Quality; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export class SettingsScreen {
  constructor(private game: Game) {}

  show(onClose?: () => void) {
    const s = loadSettings();

    const el = document.createElement('div');
    el.id = 'settings';
    el.innerHTML = `
      <div class="settings-card">
        <h2>Settings</h2>

        <label class="set-row">
          <span>Volume</span>
          <input id="set-vol" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}">
        </label>

        <label class="set-row toggle-row">
          <span>Sound effects</span>
          <button id="set-sfx" class="toggle${s.sfx ? ' on' : ''}" role="switch" aria-checked="${s.sfx}"><i></i></button>
        </label>

        <label class="set-row toggle-row">
          <span>Music</span>
          <button id="set-music" class="toggle${s.music ? ' on' : ''}" role="switch" aria-checked="${s.music}"><i></i></button>
        </label>

        <div class="set-row col">
          <span>Graphics</span>
          <div class="seg">
            ${QUALITIES.map((q) => `<button class="seg-opt${q.id === s.quality ? ' on' : ''}" data-q="${q.id}">${q.label}</button>`).join('')}
          </div>
        </div>

        <div class="set-help">🖱️ wheel zoom · right-drag orbit · left-drag pan · R reset</div>
        <button id="set-back" class="btn-gold">Done</button>
      </div>`;
    document.body.appendChild(el);

    const apply = () => { saveSettings(s); applySettings(this.game, s); };

    el.querySelector<HTMLInputElement>('#set-vol')!.addEventListener('input', (e) => {
      s.volume = Number((e.target as HTMLInputElement).value) / 100;
      apply();
    });

    const sfxBtn = el.querySelector<HTMLButtonElement>('#set-sfx')!;
    sfxBtn.addEventListener('click', () => {
      s.sfx = !s.sfx;
      sfxBtn.classList.toggle('on', s.sfx);
      sfxBtn.setAttribute('aria-checked', String(s.sfx));
      apply();
    });

    const musicBtn = el.querySelector<HTMLButtonElement>('#set-music')!;
    musicBtn.addEventListener('click', () => {
      s.music = !s.music;
      musicBtn.classList.toggle('on', s.music);
      musicBtn.setAttribute('aria-checked', String(s.music));
      apply();
    });

    el.querySelectorAll<HTMLButtonElement>('.seg-opt').forEach((b) => {
      b.addEventListener('click', () => {
        s.quality = b.dataset.q as Quality;
        el.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('on', o === b));
        apply();
      });
    });

    el.querySelector('#set-back')!.addEventListener('click', () => {
      saveSettings(s);
      el.classList.add('closing');
      setTimeout(() => el.remove(), 250);
      onClose?.();
    });
  }
}
