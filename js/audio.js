/* ============================================================
   audio.js — all sound is synthesized with the Web Audio API.
   No external audio files needed, so the game runs standalone.
   ============================================================ */

const Audio2 = (() => {
  let ctx = null;
  let musicGain, sfxGain, masterGain;
  let musicSettings = 60, sfxSettings = 80;
  let musicNodes = [];
  let musicTimer = null;
  let currentTrack = null;

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    setMusicVolume(musicSettings);
    setSfxVolume(sfxSettings);
  }

  function resume() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setMusicVolume(v) { musicSettings = v; if (musicGain) musicGain.gain.value = (v / 100) * 0.35; }
  function setSfxVolume(v) { sfxSettings = v; if (sfxGain) sfxGain.gain.value = (v / 100) * 0.9; }

  // ---- low level oscillator/noise helpers ----
  function osc(type, freq, dur, opts = {}) {
    ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (opts.freqEnd !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), ctx.currentTime + dur);
    }
    const peak = opts.vol !== undefined ? opts.vol : 0.5;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(sfxGain);
    o.start();
    o.stop(ctx.currentTime + dur + 0.05);
  }

  function noiseBurst(dur, opts = {}) {
    ensureCtx();
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.filterType || 'lowpass';
    filt.frequency.value = opts.filterFreq || 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol || 0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start();
  }

  // ---- SFX library ----
  const SFX = {
    shoot() { osc('sawtooth', 880, 0.08, { freqEnd: 220, vol: 0.18 }); },
    shootHeavy() { osc('square', 220, 0.15, { freqEnd: 80, vol: 0.25 }); noiseBurst(0.06, { vol: 0.15, filterFreq: 3000 }); },
    hit() { noiseBurst(0.08, { vol: 0.25, filterFreq: 1800 }); },
    explosion() {
      noiseBurst(0.4, { vol: 0.5, filterFreq: 900, filterType: 'lowpass' });
      osc('sine', 120, 0.35, { freqEnd: 30, vol: 0.4 });
    },
    explosionBig() {
      noiseBurst(0.8, { vol: 0.6, filterFreq: 700 });
      osc('sine', 90, 0.7, { freqEnd: 20, vol: 0.55 });
      osc('triangle', 60, 0.9, { freqEnd: 15, vol: 0.3 });
    },
    powerup() { osc('sine', 440, 0.18, { freqEnd: 880, vol: 0.3 }); osc('sine', 660, 0.22, { freqEnd: 1320, vol: 0.2, attack: 0.05 }); },
    hurt() { osc('sawtooth', 180, 0.2, { freqEnd: 60, vol: 0.3 }); },
    shieldHit() { osc('sine', 700, 0.12, { freqEnd: 400, vol: 0.25 }); },
    boost() { osc('sawtooth', 200, 0.3, { freqEnd: 900, vol: 0.2 }); },
    special() { osc('square', 300, 0.4, { freqEnd: 1200, vol: 0.3 }); osc('sawtooth', 150, 0.4, { freqEnd: 600, vol: 0.2 }); },
    uiClick() { osc('sine', 500, 0.06, { freqEnd: 700, vol: 0.2 }); },
    bossWarning() { osc('square', 120, 0.5, { vol: 0.3 }); },
    victory() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => osc('sine', f, 0.3, { vol: 0.25 }), i * 120));
    },
    gameOver() {
      [400, 340, 260, 180].forEach((f, i) => setTimeout(() => osc('sawtooth', f, 0.35, { vol: 0.25 }), i * 150));
    },
    achievement() { osc('sine', 660, 0.15, { freqEnd: 990, vol: 0.25 }); setTimeout(() => osc('sine', 990, 0.2, { freqEnd: 1320, vol: 0.2 }), 100); },
    levelUp() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => osc('triangle', f, 0.25, { vol: 0.2 }), i * 90)); }
  };

  // ---- simple generative music: two-note bass pulse + arpeggio, mood-based ----
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    currentTrack = null;
  }

  function playMusic(mood = 'menu') {
    ensureCtx();
    stopMusic();
    currentTrack = mood;
    const scales = {
      menu: [220, 261.6, 293.7, 349.2, 392, 440],
      combat: [196, 233, 261.6, 311, 349.2, 415.3],
      boss: [174.6, 207.6, 233, 277.2, 311, 349.2]
    };
    const scale = scales[mood] || scales.menu;
    const tempo = mood === 'boss' ? 180 : mood === 'combat' ? 240 : 340;
    let step = 0;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const note = scale[step % scale.length];
      const bassNote = scale[0] / 2;
      if (step % 4 === 0) osc('triangle', bassNote, 0.5, { vol: 0.12 });
      osc('sine', note, 0.35, { vol: 0.06, attack: 0.02 });
      step++;
    }, tempo);
  }

  return { ensureCtx, resume, setMusicVolume, setSfxVolume, SFX, playMusic, stopMusic };
})();
