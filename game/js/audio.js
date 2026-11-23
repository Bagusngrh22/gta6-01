// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
// Three tiny radio stations (chiptune loops) + SFX: engine hum, gunshot, siren, cash, punch.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.muted = false; this.station = 0; this.musicTimer = null; this.step = 0;
    this.stations = [
      { name: 'SOLMAR FM — Sunset Drive', bpm: 96, bass: [0, 0, 7, 5], lead: [0, 3, 7, 10, 12, 10, 7, 3], wave: 'triangle' },
      { name: 'BAY 104 — Neon Nights', bpm: 122, bass: [0, 0, 5, 3], lead: [12, 10, 7, 5, 7, 10, 12, 15], wave: 'square' },
      { name: 'CORAL COAST — Chill Tide', bpm: 76, bass: [0, 5, 3, 7], lead: [0, 5, 7, 12, 7, 5, 3, 0], wave: 'sine' },
    ];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.16; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq = 1200) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start();
  }
  shoot() { this.noise(0.12, 0.5, 2500); this.tone(180, 0.08, 'square', 0.25, 0, 60); }
  punch() { this.noise(0.09, 0.4, 700); this.tone(90, 0.1, 'sine', 0.35, 0, 45); }
  cash() { this.tone(880, 0.09, 'sine', 0.3); this.tone(1318, 0.14, 'sine', 0.3, 0.09); }
  crash() { this.noise(0.3, 0.55, 500); this.tone(70, 0.25, 'sawtooth', 0.25, 0, 35); }
  sirenBlip() { this.tone(950, 0.18, 'sine', 0.12, 0, 1400); this.tone(1400, 0.18, 'sine', 0.12, 0.18, 950); }
  horn() { this.tone(370, 0.25, 'square', 0.18); this.tone(466, 0.25, 'square', 0.14); }
  pickup() { this.tone(660, 0.08, 'sine', 0.3); this.tone(990, 0.12, 'sine', 0.3, 0.07); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.3, i * 0.11)); }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const st = this.stations[this.station];
    const beat = 60 / st.bpm / 2; this.step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      const s = this.step++;
      const root = 110;
      const bassNote = st.bass[s % st.bass.length];
      const leadNote = st.lead[s % st.lead.length];
      const bf = root * Math.pow(2, bassNote / 12);
      const lf = root * 2 * Math.pow(2, leadNote / 12);
      const t = this.ctx.currentTime;
      const mk = (freq, type, vol) => {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.95);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + beat);
      };
      mk(bf, 'sine', 0.5);
      if (s % 2 === 0) mk(lf, st.wave, 0.16);
      if (s % 4 === 2) mk(lf * 1.5, st.wave, 0.08);
    }, beat * 1000);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.stopMusic(); this.startMusic();
    return this.stations[this.station].name;
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
}
