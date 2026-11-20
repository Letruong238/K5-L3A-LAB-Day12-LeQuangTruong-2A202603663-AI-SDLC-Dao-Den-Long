// Âm thanh tổng hợp bằng WebAudio (không dùng file ngoài nên không có vấn đề bản quyền).
// Nhạc nền đêm + hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược.
let ctx = null;
let master = null;
let volume = 0.6;
let ambient = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  return ctx;
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
  if (c && !ambient) startAmbient();
}

function tone(freq, dur, { type = "sine", gain = 0.2, slideTo = null, delay = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { gain = 0.2, freq = 800, delay = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function startAmbient() {
  const c = ctx;
  const g = c.createGain();
  g.gain.value = 0.05;
  g.connect(master);
  for (const f of [110, 164.8, 220.5]) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07 + f / 4000;
    lg.gain.value = 1.2;
    lfo.connect(lg).connect(o.frequency);
    o.connect(g);
    o.start();
    lfo.start();
  }
  ambient = g;
}

export const sfx = {
  mote: () => tone(880 + Math.random() * 120, 0.12, { type: "sine", gain: 0.15, slideTo: 1320 }),
  deposit: () => tone(520, 0.1, { type: "triangle", gain: 0.15 }),
  lit: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: "triangle", gain: 0.18, delay: i * 0.09 })),
  pulse: () => {
    tone(300, 0.5, { type: "sine", gain: 0.25, slideTo: 900 });
    noise(0.3, { gain: 0.1, freq: 3000 });
  },
  hit: () => {
    noise(0.35, { gain: 0.35, freq: 500 });
    tone(140, 0.3, { type: "sawtooth", gain: 0.15, slideTo: 60 });
  },
  jump: () => tone(300, 0.15, { type: "square", gain: 0.08, slideTo: 600 }),
  dash: () => noise(0.2, { gain: 0.2, freq: 2500 }),
  charm: () => [659, 988].forEach((f, i) => tone(f, 0.25, { type: "triangle", gain: 0.15, delay: i * 0.08 })),
  steal: () => tone(700, 0.3, { type: "sawtooth", gain: 0.12, slideTo: 200 }),
  spawn: () => tone(70, 0.8, { type: "sawtooth", gain: 0.1, slideTo: 50 }),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.6, { type: "triangle", gain: 0.2, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: "sine", gain: 0.2, delay: i * 0.2 })),
  tick: () => tone(1000, 0.05, { type: "square", gain: 0.07 }),
  wind: () => noise(1.2, { gain: 0.12, freq: 900 }),
  click: () => tone(600, 0.05, { type: "triangle", gain: 0.1 }),
};
