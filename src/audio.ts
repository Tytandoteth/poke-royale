/** Synthesized WebAudio SFX — no audio assets needed. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private last: Record<string, number> = {};

  /** Call on a user gesture to unlock audio. */
  unlock() {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Rate-limit each sound type so swarms don't become noise walls. */
  private allow(name: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  private osc(
    type: OscillatorType, f0: number, f1: number, dur: number,
    gain = 0.4, delay = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.3, cutoff = 2000, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  pop() { if (this.allow('pop', 90)) this.osc('sine', 430, 170, 0.13, 0.5); }
  zap() { if (this.allow('zap', 80)) { this.osc('square', 880, 240, 0.07, 0.16); } }
  hit() { if (this.allow('hit', 70)) this.noise(0.07, 0.3, 2600); }
  thud() { if (this.allow('thud', 120)) { this.osc('sine', 130, 60, 0.16, 0.55); this.noise(0.07, 0.2, 700); } }
  boom() {
    this.osc('sine', 110, 38, 0.75, 0.9);
    this.noise(0.55, 0.55, 420);
    this.noise(0.2, 0.4, 1500);
  }
  thunder() {
    this.noise(0.45, 0.7, 3200);
    this.osc('sawtooth', 160, 45, 0.45, 0.4);
    this.noise(0.7, 0.3, 300, 0.08);
  }
  fire() {
    this.noise(0.35, 0.6, 900);
    this.osc('sawtooth', 220, 50, 0.4, 0.45);
  }
  freezeSfx() {
    this.noise(0.3, 0.4, 6000);
    this.osc('sine', 1400, 2200, 0.25, 0.2);
    this.osc('sine', 900, 1600, 0.3, 0.15, 0.05);
  }
  beep(final = false) {
    this.osc('sine', final ? 880 : 440, final ? 880 : 440, final ? 0.35 : 0.12, 0.45);
  }
  fanfare(win: boolean) {
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 277, 262];
    notes.forEach((f, i) => {
      this.osc('triangle', f, f, 0.32, 0.4, i * 0.17);
      this.osc('sine', f / 2, f / 2, 0.32, 0.25, i * 0.17);
    });
  }
}
