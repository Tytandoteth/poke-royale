import { load as loadProgress, kingLevel, levelProgress } from '../progression';
import type { Difficulty } from '../ai';

export interface HomeCallbacks {
  onPlay: (difficulty: Difficulty) => void;
  onSettings: () => void;
}

const DIFF_KEY = 'poke-royale-difficulty';

export function loadDifficulty(): Difficulty {
  const d = localStorage.getItem(DIFF_KEY);
  return d === 'easy' || d === 'hard' ? d : 'normal';
}
function saveDifficulty(d: Difficulty) {
  try { localStorage.setItem(DIFF_KEY, d); } catch { /* private mode */ }
}

const DIFFS: { id: Difficulty; label: string; sub: string }[] = [
  { id: 'easy', label: 'Rookie', sub: 'Relaxed AI' },
  { id: 'normal', label: 'Trainer', sub: 'Plays to win' },
  { id: 'hard', label: 'Champion', sub: 'Ruthless AI' },
];

export class HomeScreen {
  show(cb: HomeCallbacks) {
    const p = loadProgress();
    const lvl = kingLevel(p);
    const xpPct = Math.round(levelProgress(p) * 100);
    const total = p.wins + p.losses + p.draws;
    const winRate = total ? Math.round((p.wins / total) * 100) : 0;
    let diff = loadDifficulty();

    const el = document.createElement('div');
    el.id = 'home';
    el.innerHTML = `
      <div class="home-orbs"></div>
      <header class="profile">
        <div class="lvl-badge"><span class="lvl-king">♔</span><span class="lvl-num">${lvl}</span></div>
        <div class="profile-meta">
          <div class="profile-name">Trainer</div>
          <div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div>
        </div>
        <div class="trophies"><span class="t-icon">🏆</span><span>${p.trophies}</span></div>
      </header>

      <div class="home-hero">
        <div class="home-emblem">⚔️</div>
        <h1 class="home-title"><span>POKÉ</span> ROYALE</h1>
        <div class="home-record">${p.wins}W · ${p.losses}L${total ? ` · ${winRate}% win` : ''}</div>
      </div>

      <div class="diff-pick">
        <div class="diff-label">Opponent</div>
        <div class="diff-seg">
          ${DIFFS.map((d) => `
            <button class="diff-opt${d.id === diff ? ' on' : ''}" data-diff="${d.id}">
              <span class="d-name">${d.label}</span><span class="d-sub">${d.sub}</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="home-actions">
        <button id="home-settings" class="btn-ghost" aria-label="Settings">⚙</button>
        <button id="home-play" class="btn-gold home-play">▶ BATTLE</button>
      </div>

      <a class="home-credit" href="https://www.tiktok.com/@ty.prompts.ai" target="_blank" rel="noopener">
        🎬 Built with AI by <b>@ty.prompts.ai</b> · follow on TikTok
      </a>`;
    document.body.appendChild(el);

    el.querySelectorAll<HTMLButtonElement>('.diff-opt').forEach((b) => {
      b.addEventListener('click', () => {
        diff = b.dataset.diff as Difficulty;
        saveDifficulty(diff);
        el.querySelectorAll('.diff-opt').forEach((o) => o.classList.toggle('on', o === b));
      });
    });

    el.querySelector('#home-settings')!.addEventListener('click', () => cb.onSettings());
    el.querySelector('#home-play')!.addEventListener('click', () => {
      el.classList.add('closing');
      setTimeout(() => el.remove(), 320);
      cb.onPlay(diff);
    });
  }
}
