import type { UnitStats } from './types';

export interface UiState {
  elixir: number;
  maxElixir: number;
  hand: UnitStats[];
  next: UnitStats;
  timeLeft: number;
  overtime: boolean;
  crowns: [number, number];
}

export interface UiCallbacks {
  onPreview(handIndex: number, clientX: number, clientY: number): void;
  onPreviewEnd(): void;
  onDeploy(handIndex: number, clientX: number, clientY: number): boolean;
  onDragStateChange(dragging: boolean): void;
}

export class UI {
  private cb: UiCallbacks;
  private cardEls: HTMLDivElement[] = [];
  private nextEmoji!: HTMLElement;
  private elixirFill!: HTMLElement;
  private elixirNum!: HTMLElement;
  private elixirBar!: HTMLElement;
  private timerEl!: HTMLElement;
  private scoreP!: HTMLElement;
  private scoreE!: HTMLElement;
  private x2El!: HTMLElement;
  private banner!: HTMLElement;
  private bannerT: number | null = null;

  private selected = -1;
  private dragging = false;
  private lastHandIds: string[] = [];

  constructor(cb: UiCallbacks) {
    this.cb = cb;
    this.build();
  }

  private build() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="vignette"></div>
      <div id="topbar">
        <div id="score-p" class="score"><span class="crown">👑</span><b>0</b></div>
        <div id="timer-wrap">
          <div id="timer">3:00</div>
          <div id="x2">2× ELIXIR</div>
        </div>
        <div id="score-e" class="score"><b>0</b><span class="crown">👑</span></div>
      </div>
      <div id="banner"></div>
      <div id="hint">🖱️ drag a card onto your half to deploy<br>⚙️ wheel: zoom · right-drag: orbit · left-drag: pan<br>⌨️ R: reset view · M: mute</div>
      <div id="bottom">
        <div id="deckrow">
          <div id="next"><span class="emoji"></span><span>Next</span></div>
          <div id="hand"></div>
        </div>
        <div id="elixir-row">
          <div id="elixir-gem"><span id="elixir-num">5</span></div>
          <div id="elixir">
            <div id="elixir-fill"></div>
            <div id="elixir-ticks"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(hud);

    this.nextEmoji = hud.querySelector('#next .emoji')!;
    this.elixirFill = hud.querySelector('#elixir-fill')!;
    this.elixirNum = hud.querySelector('#elixir-num')!;
    this.elixirBar = hud.querySelector('#elixir')!;
    this.timerEl = hud.querySelector('#timer')!;
    this.scoreP = hud.querySelector('#score-p b')!;
    this.scoreE = hud.querySelector('#score-e b')!;
    this.x2El = hud.querySelector('#x2')!;
    this.banner = hud.querySelector('#banner')!;

    const hand = hud.querySelector('#hand')!;
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<span class="cost"></span><span class="emoji"></span><span class="name"></span>`;
      hand.appendChild(card);
      this.cardEls.push(card);

      card.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (card.classList.contains('disabled')) return;
        this.selected = i;
        this.dragging = true;
        this.cb.onDragStateChange(true);
        this.refreshSelection();
      });
    }

    window.addEventListener('pointermove', (e) => {
      if (this.dragging && this.selected >= 0) {
        this.cb.onPreview(this.selected, e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.dragging && this.selected >= 0) {
        const overUi = (e.target as HTMLElement)?.closest?.('#bottom');
        if (!overUi) this.cb.onDeploy(this.selected, e.clientX, e.clientY);
        this.dragging = false;
        this.selected = -1;
        this.cb.onDragStateChange(false);
        this.cb.onPreviewEnd();
        this.refreshSelection();
      }
    });
  }

  private refreshSelection() {
    this.cardEls.forEach((el, i) => el.classList.toggle('selected', i === this.selected));
  }

  showBanner(text: string) {
    this.banner.textContent = text;
    // single digits & "Battle!" get the huge countdown treatment
    this.banner.classList.toggle('mega', text.length <= 2 || text.includes('Battle!'));
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the pop animation
    this.banner.classList.add('show');
    if (this.bannerT) clearTimeout(this.bannerT);
    this.bannerT = window.setTimeout(() => this.banner.classList.remove('show'), 2200);
  }

  refresh(s: UiState) {
    // elixir
    const frac = s.elixir / s.maxElixir;
    this.elixirFill.style.width = `${frac * 100}%`;
    this.elixirNum.textContent = String(Math.floor(s.elixir));

    // hand
    const ids = s.hand.map((c) => c.id);
    const handChanged = ids.join() !== this.lastHandIds.join();
    s.hand.forEach((card, i) => {
      const el = this.cardEls[i];
      if (handChanged) {
        (el.querySelector('.emoji') as HTMLElement).textContent = card.emoji;
        (el.querySelector('.name') as HTMLElement).textContent = card.name;
        (el.querySelector('.cost') as HTMLElement).textContent = String(card.cost);
        el.style.background = `linear-gradient(160deg, ${card.uiColor} 0%, #1c2240 130%)`;
      }
      el.classList.toggle('disabled', s.elixir < card.cost);
    });
    if (handChanged) this.lastHandIds = ids;
    this.nextEmoji.textContent = s.next.emoji;

    // timer
    const t = Math.max(0, Math.ceil(s.timeLeft));
    this.timerEl.textContent = s.overtime
      ? `OT ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
      : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', s.overtime || s.timeLeft < 60);
    const doubleElixir = s.overtime || (s.timeLeft <= 60 && s.timeLeft > 0);
    this.x2El.classList.toggle('on', doubleElixir);
    this.elixirBar.classList.toggle('double', doubleElixir);

    this.scoreP.textContent = String(s.crowns[0]);
    this.scoreE.textContent = String(s.crowns[1]);
  }

  showEnd(result: 'win' | 'lose' | 'draw', crowns: [number, number]) {
    const msg = document.createElement('div');
    msg.id = 'msg';
    const title = result === 'win' ? 'VICTORY!' : result === 'lose' ? 'DEFEAT' : 'DRAW';
    const palette = ['#ffc83d', '#ff8df1', '#4d9bff', '#6dffa0', '#ff5d5d', '#ffffff'];
    const confetti = result === 'win'
      ? Array.from({ length: 44 }, () => {
          const x = (Math.random() * 100).toFixed(1);
          const d = (2.4 + Math.random() * 2.4).toFixed(2);
          const dl = (-Math.random() * 4).toFixed(2);
          const r = Math.round(Math.random() * 720 - 360);
          const c = palette[Math.floor(Math.random() * palette.length)];
          return `<i class="cf" style="--x:${x}vw;--d:${d}s;--dl:${dl}s;--r:${r}deg;--c:${c}"></i>`;
        }).join('')
      : '';
    msg.innerHTML = `
      <div class="rays"></div>
      ${confetti}
      <h1 class="${result}">${title}</h1>
      <div class="crowns-line">👑 <span class="b">${crowns[0]}</span> — <span class="r">${crowns[1]}</span> 👑</div>
      <button id="msg-btn" class="btn-gold">⚔️ Battle Again</button>`;
    document.body.appendChild(msg);
    msg.querySelector('#msg-btn')!.addEventListener('click', () => location.reload());
  }
}
