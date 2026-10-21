/**
 * src/audio/audio.js — 외부 오디오 파일 없이 WebAudio API로 실시간 합성하는 사운드 & BGM 엔진
 * 창 전환/탭 숨김(visibilitychange, blur) 시 자동 페이드 음소거 및 복귀 지원
 */
import { G } from '../core/state.js';
import { saveProgress } from '../core/progress.js';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.noiseBuf = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgHidden = false;
  }

  init() {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.bgHidden) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.connect(comp);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.master);

      // 노이즈 버퍼 생성 (폭발음, 타격음용)
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.syncVolumes();
      this.startBgmLoop();
    } catch (_) {
      this.ctx = null;
    }
  }

  syncVolumes() {
    if (!this.ctx || !this.master) return;
    const s = G.save.settings;
    const muteAll = s.muted || (s.bgMute && this.bgHidden);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muteAll ? 0 : 0.85, t, 0.04);
    this.sfxGain.gain.setTargetAtTime(s.sfxVol ?? 0.75, t, 0.04);
    this.bgmGain.gain.setTargetAtTime((s.bgmVol ?? 0.5) * 0.25, t, 0.06);
  }

  setMuted(m) {
    G.save.settings.muted = !!m;
    saveProgress(G.save);
    this.syncVolumes();
  }

  onVisibilityChange(hidden) {
    this.bgHidden = hidden;
    if (!this.ctx) return;
    this.syncVolumes();
    if (hidden && G.save.settings.bgMute) {
      setTimeout(() => {
        if (this.bgHidden && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      }, 180);
    } else if (!hidden && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  startBgmLoop() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    // 아르페지오 신스 루프 (전투 긴장감 + 보스전 변주)
    const scaleNormal = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 392.0];
    const scaleBoss = [196, 233.08, 261.63, 277.18, 349.23, 392, 466.16, 349.23];
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || G.phase !== 'play') return;
      if (G.save.settings.muted || (G.save.settings.bgmVol ?? 0.5) <= 0.01) return;
      const notes = G.isBossWave ? scaleBoss : scaleNormal;
      const freq = notes[this.bgmStep % notes.length];
      this.bgmStep++;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = G.isBossWave ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.5, t);

      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = G.isBossWave ? 950 : 680;

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(flt);
      flt.connect(g);
      g.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }, 240);
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || G.save.settings.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, cutoff = 600, vol = 0.3, delay = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.noiseBuf || G.save.settings.muted) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(cutoff, t);
    flt.frequency.exponentialRampToValueAtTime(110, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(kind, tier = 1) {
    this.init();
    if (!this.ctx) return;
    switch (kind) {
      case 'click':
        this.tone(680, 0.05, 'triangle', 0.15, 880);
        break;
      case 'summon':
        if (tier >= 7) {
          // 태초 강림 웅장한 화음 팡파르
          [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
            this.tone(f, 0.55, 'sawtooth', 0.26, f * 1.02, i * 0.07);
            this.tone(f * 0.5, 0.65, 'triangle', 0.22, null, i * 0.07);
          });
          this.noise(0.45, 1200, 0.35);
        } else if (tier >= 5) {
          // 전설/신화 팡파르
          [440, 554.37, 659.25, 880].forEach((f, i) => {
            this.tone(f, 0.35, 'triangle', 0.24, null, i * 0.06);
          });
        } else if (tier >= 3) {
          // 에픽/유니크
          this.tone(520, 0.14, 'triangle', 0.2, 780);
          this.tone(780, 0.22, 'sine', 0.22, 1040, 0.08);
        } else {
          this.tone(380, 0.1, 'sine', 0.18, 620);
        }
        break;
      case 'combine':
        this.tone(440, 0.12, 'triangle', 0.22, 660);
        this.tone(660, 0.22, 'triangle', 0.25, 990, 0.07);
        if (tier >= 5) this.play('summon', tier);
        break;
      case 'shoot_striker':
        this.tone(920 + Math.random() * 180, 0.045, 'square', 0.065, 320);
        break;
      case 'shoot_destroyer':
        this.noise(0.18, 480, 0.16);
        this.tone(140, 0.14, 'sawtooth', 0.12, 52);
        break;
      case 'shoot_arcane':
        this.tone(1200 + Math.random() * 250, 0.08, 'sine', 0.08, 620);
        break;
      case 'proc':
        this.tone(880, 0.18, 'sawtooth', 0.16, 440);
        this.noise(0.22, 900, 0.18);
        break;
      case 'gamble_win':
        [587.33, 740, 880, 1174.66].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.22, null, i * 0.055));
        break;
      case 'gamble_fail':
        this.tone(280, 0.18, 'sawtooth', 0.18, 170);
        this.tone(190, 0.26, 'sawtooth', 0.18, 110, 0.12);
        break;
      case 'upgrade':
        this.tone(480, 0.1, 'triangle', 0.18, 720);
        this.tone(720, 0.15, 'triangle', 0.18, 960, 0.06);
        break;
      case 'boss_alert':
        [320, 480, 320, 480].forEach((_, i) => this.tone(240, 0.22, 'sawtooth', 0.22, 420, i * 0.25));
        break;
      case 'coin':
        this.tone(1046, 0.07, 'sine', 0.12, 1318);
        break;
      case 'over':
        [392, 349.23, 329.63, 261.63].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.22, f * 0.92, i * 0.18));
        break;
    }
  }
}

export const Snd = new SoundEngine();

if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => Snd.onVisibilityChange(true));
  window.addEventListener('focus', () => Snd.onVisibilityChange(false));
  document.addEventListener('visibilitychange', () => Snd.onVisibilityChange(document.hidden));
}
