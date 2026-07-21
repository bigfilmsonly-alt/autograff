import React, { useState, useRef, useEffect, useCallback } from 'react';
import { upload } from '@vercel/blob/client';

/* ══════════════════════════ GLOBAL STYLES ══════════════════════════ */
if (typeof document !== 'undefined') {
  const _s = document.createElement('style');
  _s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { display: none; }
    html, body, #root { height:100%; overflow:hidden; }
    body { font-family: Georgia, serif; background: #000; color: #fff; font-weight: 600; }
    @media (min-width:769px) {
      body { background: #000; }
    }
    @keyframes heartBurst {
      0%   { opacity:0; transform:translate(-50%,-50%) scale(0.2) rotate(0deg); }
      16%  { opacity:1; transform:translate(-50%,-50%) scale(1.12) rotate(0deg); }
      100% { opacity:0; transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.42) rotate(var(--r)); }
    }
    @keyframes marqueeText {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes heroZoom {
      from { transform: scale(1.02); }
      to   { transform: scale(1.11); }
    }
    input[type="range"] {
      -webkit-appearance: none; height:4px; background:rgba(0,0,0,0.15); border-radius:0; outline:none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance:none; width:16px; height:16px; background:#fff; border:2px solid #000;
      border-radius:0; cursor:pointer;
    }
    /* Phone rotated to landscape. Tests "short viewport", not device class:
       (min-width:769px) would also match a landscape iPhone (844px wide), and a
       bare (orientation:landscape) would also match every desktop window. */
    @media (orientation: landscape) and (max-height: 460px) {
      /* Duplicates the "+ UPLOAD" button already in the header, at a cost of 174px
         — 45% of a 390px-tall viewport. */
      .pc-cta { display: none !important; }
      /* Clear the fixed NavBar the .pc-cta padding used to clear. Same env()
         expression as the NavBar itself so the two can never drift apart. */
      .pc-shelf { padding-bottom: calc(58px + max(14px, env(safe-area-inset-bottom, 14px))); }
      /* min-height:0 is load-bearing: a flex item defaults to min-height:auto and
         would refuse to shrink below its content, silently defeating the stretch. */
      .pc-scroller { flex: 1 1 auto; min-height: 0; align-items: stretch !important; }
      /* Height now comes from the stretched flex line; aspect-ratio derives width. */
      .pc-card { width: auto !important; }
    }
    /* Paint-drip on the @ mark: a droplet swells at the drip tip, elongates, detaches
       and falls away, then a dormant beat before the next drip. */
    @keyframes atDrip {
      0%   { opacity: 0; transform: translate(-50%, 0%)   scale(0.5, 0.6); }
      10%  { opacity: 1; transform: translate(-50%, 15%)  scale(0.9, 1.3); }
      26%  { opacity: 1; transform: translate(-50%, 110%) scale(1, 1.7); }
      40%  { opacity: 1; transform: translate(-50%, 300%) scale(1.05, 1); }
      56%  { opacity: 1; transform: translate(-50%, 480%) scale(0.95, 1); }
      70%  { opacity: 0; transform: translate(-50%, 620%) scale(0.8, 0.8); }
      100% { opacity: 0; transform: translate(-50%, 620%) scale(0.8, 0.8); }
    }
    @media (prefers-reduced-motion: reduce) { .at-drop { animation: none !important; opacity: 0 !important; } }
  `;
  document.head.appendChild(_s);
}

/* ══════════════════════════ CONSTANTS ══════════════════════════ */
// Refined heart burst \u2014 crisp white marks, generous in number, brief in motion.
const HEART_PATH = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
function makeHeartBurst(x, y, count) {
  const n = count || (12 + Math.floor(Math.random() * 5));
  return Array.from({ length: n }, (_, i) => {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.92;
    const dist = 44 + Math.random() * 94;
    return {
      id: Date.now() + i + Math.random(),
      x, y,
      size: 12 + Math.random() * 20,
      dur: 0.7 + Math.random() * 0.32,
      tx: Math.cos(ang) * dist,
      ty: Math.sin(ang) * dist - 12,
      r: (Math.random() - 0.5) * 44,
    };
  });
}

const makePlaceholder = (c1, c2, label, shapes = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="600" height="400" fill="url(#g)"/>${shapes}
    <text x="300" y="208" text-anchor="middle" fill="rgba(255,255,255,0.45)"
      font-size="22" font-family="Impact,sans-serif" letter-spacing="3">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const LOGO_URI = '/at-mark-white.png';

// INTEGRITY: seed/mock data is gated behind import.meta.env.DEV — a compile-time
// constant that is `false` in every production build, so these literals are dead-code-
// eliminated and can NEVER render (or even ship) in production. Prod shows only real data.
const SEED_PHOTOS = import.meta.env.DEV ? [
  { id:1,  src:'/photos/1-surfer.jpg',      type:'image', user:'aurora_lens',   title:'Big Wave',        likes:2340 },
  { id:2,  src:'/photos/2-leopards.jpg',     type:'image', user:'pixel_nomad',   title:'Wild Leopards',   likes:1870 },
  { id:3,  src:'/photos/3-miami-sunset.jpg', type:'image', user:'shuttercraft',  title:'Miami Sunset',    likes:1540 },
  { id:4,  src:'/photos/4-vw-buzz.jpg',      type:'image', user:'frame_wolf',    title:'VW Buzz',         likes:980 },
  { id:5,  src:'/photos/5-sneaker.jpg',      type:'image', user:'lenscraft99',   title:'Custom Kicks',    likes:1120 },
  { id:6,  src:'/photos/6-wave.jpg',         type:'image', user:'voidshooter',   title:'Ocean Power',     likes:2100 },
  { id:7,  src:'/photos/7-lambo.jpg',        type:'image', user:'chromatic_eye', title:'Art Car',         likes:3200 },
  { id:8,  src:'/photos/8-stick-art.jpg',    type:'image', user:'aurora_lens',   title:'Stick Figure',    likes:890 },
  { id:9,  src:'/photos/9-leopards2.jpg',    type:'image', user:'pixel_nomad',   title:'Safari Cubs',     likes:1650 },
  { id:10, src:'/photos/10-robot-art.jpg',   type:'image', user:'frame_wolf',    title:'Robot Sculpture', likes:760 },
  { id:11, src:'/photos/11-secret.jpg',      type:'image', user:'lenscraft99',   title:'Secret Project',  likes:540 },
  { id:12, src:'/photos/12-vw-yellow.jpg',   type:'image', user:'shuttercraft',  title:'Yellow Buzz',     likes:1430 },
  { id:13, src:'/photos/13-miami-bay.jpg',   type:'image', user:'voidshooter',   title:'Bay View',        likes:1980 },
] : [];

const MOCK_MEMBERS = import.meta.env.DEV ? [
  { id:1, handle:'aurora_lens', name:'Aurora Lane', bio:'Capturing light & shadow. Miami based photographer.', score:8420, rank:'Gold', followers:1200, following:180, posts:SEED_PHOTOS.slice(0,4) },
  { id:2, handle:'pixel_nomad', name:'Alex Nomad', bio:'Street art & travel. Always moving, always shooting.', score:5100, rank:'Gold', followers:890, following:220, posts:SEED_PHOTOS.slice(2,6) },
  { id:3, handle:'shuttercraft', name:'Sam Craft', bio:'Urban geometry. Architecture through my lens.', score:3200, rank:'Silver', followers:670, following:340, posts:SEED_PHOTOS.slice(4,8) },
  { id:4, handle:'frame_wolf', name:'Felix Wolf', bio:'Nature & wildlife. Film + digital hybrid.', score:1800, rank:'Silver', followers:430, following:190, posts:SEED_PHOTOS.slice(6,10) },
  { id:5, handle:'lenscraft99', name:'Lena Cruz', bio:'Murals & public art across the Americas.', score:980, rank:'Bronze', followers:310, following:280, posts:SEED_PHOTOS.slice(8,12) },
  { id:6, handle:'voidshooter', name:'Victor Odin', bio:'Minimalist compositions in urban spaces.', score:540, rank:'Bronze', followers:210, following:150, posts:SEED_PHOTOS.slice(10,13) },
  { id:7, handle:'chromatic_eye', name:'Chroma Blake', bio:'Color theory in the wild.', score:310, rank:'Bronze', followers:125, following:90, posts:SEED_PHOTOS.slice(0,3) },
  { id:8, handle:'stellarframe', name:'Stella Ray', bio:'Astrophotography meets street.', score:180, rank:'Bronze', followers:88, following:45, posts:SEED_PHOTOS.slice(5,8) },
] : [];

const NAV_ITEMS = [
  { key:'guest',       label:'GALLERY',  icon:'\uD83D\uDD0D' },
  { key:'photos',      label:'PHOTOS',   icon:'\uD83D\uDDBC' },
  { key:'leaderboard', label:'BOARD',    icon:'\uD83C\uDFC6' },
  { key:'members',     label:'MEMBERS',  icon:'\uD83D\uDC65' },
  { key:'studio',      label:'STUDIO',   icon:'\uD83C\uDFB5' },
  { key:'profile',     label:'YOU',      icon:'\uD83D\uDC64' },
];

/* FL-Studio-style channel rack. `sound` selects the synthesis voice in playSound. */
const TRACK_DEFS = [
  { id:1,  name:'KICK',     emoji:'\uD83E\uDD41', color:'#fff',    sound:'kick',    freq:150, decay:0.28, vol:0.95 },
  { id:7,  name:'808',      emoji:'\uD83D\uDD0A', color:'#7c3aed', sound:'sub808',  freq:55,  decay:0.70, vol:0.9  },
  { id:2,  name:'SNARE',    emoji:'\uD83D\uDD34', color:'#e11d48', sound:'snare',   freq:190, decay:0.18, vol:0.75 },
  { id:8,  name:'CLAP',     emoji:'\uD83D\uDC4F', color:'#f43f5e', sound:'clap',    freq:1500,decay:0.20, vol:0.7  },
  { id:3,  name:'HI-HAT',   emoji:'\u26A1',        color:'#0891b2', sound:'hat',     freq:9000,decay:0.045,vol:0.5  },
  { id:9,  name:'OPEN HAT', emoji:'\uD83D\uDD25', color:'#06b6d4', sound:'openhat', freq:8000,decay:0.32, vol:0.45 },
  { id:4,  name:'BASS',     emoji:'\uD83C\uDFB8', color:'#334155', sound:'bass',    freq:55,  decay:0.35, vol:0.8  },
  { id:5,  name:'SYNTH',    emoji:'\uD83C\uDFB9', color:'#2563eb', sound:'synth',   freq:440, decay:0.28, vol:0.6  },
  { id:10, name:'LEAD',     emoji:'\uD83C\uDFBA', color:'#16a34a', sound:'lead',    freq:660, decay:0.30, vol:0.55 },
  { id:6,  name:'PERC',     emoji:'\uD83E\uDD41', color:'#a16207', sound:'perc',    freq:320, decay:0.20, vol:0.65 },
  { id:11, name:'TOM',      emoji:'\uD83E\uDD41', color:'#b45309', sound:'tom',     freq:160, decay:0.32, vol:0.7  },
  { id:12, name:'RIM',      emoji:'\uD83D\uDCCC', color:'#78716c', sound:'rim',     freq:1700,decay:0.05, vol:0.6  },
  { id:13, name:'COWBELL',  emoji:'\uD83D\uDD14', color:'#ca8a04', sound:'cowbell', freq:560, decay:0.25, vol:0.55 },
  { id:14, name:'CRASH',    emoji:'\uD83D\uDCA5', color:'#0e7490', sound:'crash',   freq:6000,decay:1.10, vol:0.4  },
];

/* Genre templates tuned to recognizable, high-engagement grooves.
   Track ids: 1 KICK 2 SNARE 3 HIHAT 4 BASS 5 SYNTH 6 PERC 7 808 8 CLAP 9 OPENHAT 10 LEAD 11 TOM 12 RIM 13 COWBELL 14 CRASH */
const PRESETS = {
  'TRAP':        { bpm:140, swing:16, patterns:{ 1:[1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1], 7:[1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] }},
  'DRILL':       { bpm:142, swing:10, patterns:{ 1:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1], 7:[1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] }},
  'PHONK':       { bpm:135, swing:0,  patterns:{ 1:[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1], 7:[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0], 13:[1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0] }},
  'HIP HOP':     { bpm:90,  swing:42, patterns:{ 1:[1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 4:[1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0], 6:[0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0] }},
  'BOOM BAP':    { bpm:88,  swing:32, patterns:{ 1:[1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 4:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], 14:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }},
  'REGGAETON':   { bpm:96,  swing:0,  patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 8:[0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 13:[0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0], 4:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] }},
  'AMAPIANO':    { bpm:112, swing:22, patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 4:[0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0], 3:[0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1], 12:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0], 6:[0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1] }},
  'AFROBEAT':    { bpm:108, swing:18, patterns:{ 1:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 6:[0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0], 13:[0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0], 4:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0] }},
  'HOUSE BEAT':  { bpm:124, swing:0,  patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 9:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 4:[1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0] }},
  'DANCE POP':   { bpm:124, swing:0,  patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 9:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 14:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }},
  'TECHNO':      { bpm:128, swing:0,  patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 9:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 5:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] }},
  'UK GARAGE':   { bpm:132, swing:42, patterns:{ 1:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], 9:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0], 4:[1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0] }},
  'DNB':         { bpm:172, swing:0,  patterns:{ 1:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,1,0,1,1,0,1,0,1,1,0,1,1,0], 4:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 9:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0] }},
  'JERSEY CLUB': { bpm:140, swing:0,  patterns:{ 1:[1,0,0,1,0,0,1,0,1,0,1,0,0,0,0,0], 8:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 13:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1], 2:[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0] }},
  'LOFI':        { bpm:78,  swing:34, patterns:{ 1:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], 12:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 4:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0], 6:[0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0] }},
};

/* ══════════════════════════ AUDIO ENGINE ══════════════════════════ */
function noiseBuffer(ctx, dur) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function env(ctx, dest, time, attack, decay, peak) {
  const g = ctx.createGain();
  g.connect(dest);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(peak, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return g;
}
function tone(ctx, dest, type, f0, f1, time, attack, decay, peak) {
  const g = env(ctx, dest, time, attack, decay, peak);
  const osc = ctx.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(f0, time);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, time + attack + decay);
  osc.connect(g); osc.start(time); osc.stop(time + attack + decay + 0.02);
  return osc;
}
function noise(ctx, dest, filterType, freq, q, time, attack, decay, peak) {
  const g = env(ctx, dest, time, attack, decay, peak);
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, attack + decay + 0.02);
  const filt = ctx.createBiquadFilter();
  filt.type = filterType; filt.frequency.value = freq; if (q) filt.Q.value = q;
  src.connect(filt); filt.connect(g); src.start(time); src.stop(time + attack + decay + 0.02);
}
function playSound(ctx, track, time, vol) {
  const out = ctx.destination;
  const v = (vol ?? 1) * (track.vol ?? 0.8);
  switch (track.sound) {
    case 'kick':
      tone(ctx, out, 'sine', track.freq, 40, time, 0.001, track.decay, v);
      noise(ctx, out, 'lowpass', 1200, 0, time, 0.001, 0.02, v * 0.4); // beater click
      break;
    case 'sub808':
      tone(ctx, out, 'sine', track.freq * 2.4, track.freq, time, 0.001, 0.05, v); // pitch drop
      tone(ctx, out, 'sine', track.freq, track.freq * 0.9, time, 0.01, track.decay, v);
      break;
    case 'snare':
      tone(ctx, out, 'triangle', track.freq, track.freq * 0.7, time, 0.001, track.decay * 0.6, v * 0.5); // body
      noise(ctx, out, 'highpass', 1800, 0, time, 0.001, track.decay, v * 0.9); // crack
      break;
    case 'clap': {
      const bursts = [0, 0.012, 0.024, 0.05];
      bursts.forEach((o, i) => noise(ctx, out, 'bandpass', track.freq, 1.2, time + o, 0.001, i === 3 ? track.decay : 0.03, v * (i === 3 ? 1 : 0.7)));
      break;
    }
    case 'hat':
      noise(ctx, out, 'highpass', track.freq, 0, time, 0.001, track.decay, v);
      break;
    case 'openhat':
      noise(ctx, out, 'highpass', track.freq, 0, time, 0.001, track.decay, v);
      break;
    case 'bass':
      tone(ctx, out, 'sawtooth', track.freq, track.freq, time, 0.01, track.decay, v);
      break;
    case 'synth':
      tone(ctx, out, 'square', track.freq, track.freq, time, 0.02, track.decay, v * 0.9);
      tone(ctx, out, 'square', track.freq * 1.5, track.freq * 1.5, time, 0.02, track.decay, v * 0.4); // fifth
      break;
    case 'lead':
      tone(ctx, out, 'sawtooth', track.freq, track.freq, time, 0.01, track.decay, v);
      break;
    case 'perc':
      tone(ctx, out, 'triangle', track.freq, track.freq * 0.6, time, 0.001, track.decay, v);
      break;
    case 'tom':
      tone(ctx, out, 'sine', track.freq, track.freq * 0.55, time, 0.001, track.decay, v);
      break;
    case 'rim':
      tone(ctx, out, 'square', track.freq, track.freq, time, 0.001, track.decay, v * 0.7);
      noise(ctx, out, 'bandpass', track.freq, 2, time, 0.001, track.decay, v * 0.6);
      break;
    case 'cowbell':
      tone(ctx, out, 'square', 540, 540, time, 0.001, track.decay, v * 0.6);
      tone(ctx, out, 'square', 800, 800, time, 0.001, track.decay, v * 0.5);
      break;
    case 'crash':
      noise(ctx, out, 'highpass', track.freq, 0, time, 0.001, track.decay, v);
      break;
    default:
      tone(ctx, out, 'sine', track.freq, track.freq, time, 0.005, track.decay, v);
  }
}

/* ══════════════════════════ HOOKS ══════════════════════════ */
function useFloatingHearts() {
  const [bursts, setBursts] = useState([]);
  const spawn = useCallback((x, y) => {
    const h = makeHeartBurst(x, y);
    setBursts(prev => [...prev, ...h]);
    setTimeout(() => setBursts(prev => prev.filter(b => !h.includes(b))), 1300);
  }, []);
  return { bursts, spawn };
}

/* ══════════════════════════ SMALL COMPONENTS ══════════════════════════ */
const IMP = "Impact,'Arial Narrow',sans-serif";
const HELV = "Helvetica,'Helvetica Neue',Arial,sans-serif";
/* A stable, absurd waitlist position per visitor — gamified hype, not a real count. */
function waitlistNumber() {
  try {
    let n = localStorage.getItem('autograff_waitnum');
    if (!n) { n = String(1000000 + Math.floor(Math.random() * 3240000)); localStorage.setItem('autograff_waitnum', n); }
    return Number(n).toLocaleString();
  } catch (_) { return '1,284,309'; }
}

/* Opens the VIP modal from anywhere (bypasses the auto-popup gates). */
const openVIP = () => { try { window.dispatchEvent(new Event('open-vip')); } catch (_) {} };

/* ── Sharing + referral tracking ── */
const SITE_URL = 'https://www.aut0graff.com';
/* Stable per-visitor id used as their referral code in share links. */
function myRef() {
  try {
    let id = localStorage.getItem('autograff_uid');
    if (!id) { id = Math.random().toString(36).slice(2, 9); localStorage.setItem('autograff_uid', id); }
    return id;
  } catch (_) { return ''; }
}
/* Display handle for this visitor on the supporter ledger. */
function myHandle() {
  try {
    let h = localStorage.getItem('autograff_handle');
    if (!h) { h = 'guest_' + myRef(); localStorage.setItem('autograff_handle', h); }
    return h;
  } catch (_) { return 'guest'; }
}
/* Record a like: bumps the photo AND this visitor's supporter score. */
const _likeQ = {}; const _likeT = {};
function sendLike(id, n = 1) {
  const key = String(id);
  _likeQ[key] = (_likeQ[key] || 0) + n;
  clearTimeout(_likeT[key]);
  // Collapse rapid taps into a single POST that carries the accumulated count.
  _likeT[key] = setTimeout(() => {
    const count = _likeQ[key]; delete _likeQ[key];
    try {
      fetch('/api/likes', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, uid: myRef(), name: myHandle(), count }) });
    } catch (_) {}
  }, 400);
}
/* Record a share (curated-gallery + feed both feed the leaderboard). */
function sendShare(id) {
  try {
    fetch('/api/likes', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, action:'share' }) });
  } catch (_) {}
}
/* Per-visitor set of photo ids they've already liked (Instagram-style filled heart persists). */
function likedSet() { try { return new Set(JSON.parse(localStorage.getItem('autograff_liked') || '[]')); } catch (_) { return new Set(); } }
function hasLiked(id) { return likedSet().has(String(id)); }
function markLiked(id) { try { const s = likedSet(); s.add(String(id)); localStorage.setItem('autograff_liked', JSON.stringify([...s])); } catch (_) {} }
/* Register presence so lurkers who never like still surface at zero. */
function pingSeen() {
  try {
    fetch('/api/likes', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'seen', uid: myRef(), name: myHandle() }) });
  } catch (_) {}
}
/* Who referred THIS visitor (from ?ref= on first landing), if anyone. */
function referredBy() { try { return localStorage.getItem('autograff_referred_by') || ''; } catch (_) { return ''; } }
/* Capture a ?ref= param once, on first landing. */
function captureRef() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && !localStorage.getItem('autograff_referred_by')) {
      localStorage.setItem('autograff_referred_by', ref.slice(0, 40));
    }
  } catch (_) {}
}
function shareLink() { const r = myRef(); return r ? `${SITE_URL}/?ref=${encodeURIComponent(r)}` : SITE_URL; }
/* Native share sheet → clipboard → SMS fallback. */
async function shareAutograff(text) {
  const url = shareLink();
  const message = text || 'Check out AUTOGRAFF — Share to Win. iOS app coming soon.';
  try { if (navigator.share) { await navigator.share({ title: 'AUTOGRAFF', text: message, url }); return; } }
  catch (_) { return; /* user cancelled */ }
  try { await navigator.clipboard.writeText(`${message} ${url}`); alert('Link copied — share it anywhere!'); return; } catch (_) {}
  try { window.location.href = `sms:?&body=${encodeURIComponent(message + ' ' + url)}`; } catch (_) {}
}

/* Floating "WAITING LIST" pill shown above the NavBar on every non-splash page. */
function VIPFab() {
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    try { setJoined(!!localStorage.getItem('autograff_vip')); } catch (_) {}
    const sync = () => { try { setJoined(!!localStorage.getItem('autograff_vip')); } catch (_) {} };
    window.addEventListener('vip-joined', sync);
    return () => window.removeEventListener('vip-joined', sync);
  }, []);
  return (
    <button onClick={openVIP} style={{
      position:'fixed', right:16, zIndex:300,
      bottom:'calc(72px + env(safe-area-inset-bottom, 0px))',
      display:'flex', alignItems:'center', gap:7,
      background:'#000', color:'#fff', border:'1px solid rgba(255,255,255,0.15)',
      borderRadius:0, padding:'11px 18px', cursor:'pointer',
      fontFamily:IMP, fontSize:12, letterSpacing:2,
      boxShadow:'0 6px 22px rgba(0,0,0,0.28)', WebkitTapHighlightColor:'transparent',
    }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}
    >
      {joined && <span style={{ fontSize:13 }}>{'\u2713'}</span>}
      {joined ? 'ON THE LIST' : 'WAITING LIST'}
    </button>
  );
}

/* App Store "coming soon" band — launch framing + VIP CTA. */
function AppStoreBanner({ style }) {
  return (
    <div style={{ background:'#000', color:'#fff', borderRadius:0, padding:'24px 22px', textAlign:'center',
      backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 12px)',
      border:'1px solid rgba(255,255,255,0.08)', ...style }}>
      <div style={{ fontSize:26, marginBottom:8 }}>{'\uD83D\uDCF1'}</div>
      <div style={{ fontFamily:IMP, fontSize:10, letterSpacing:5, color:'#fff', marginBottom:8 }}>COMING SOON TO iOS</div>
      <div style={{ fontFamily:IMP, fontSize:'clamp(20px,5.5vw,26px)', letterSpacing:1, lineHeight:1.1, marginBottom:10 }}>THE APP DROPS<br/>ON THE APP STORE</div>
      <div style={{ fontSize:12.5, lineHeight:1.55, color:'#fff', maxWidth:320, margin:'0 auto 18px' }}>
        AUTOGRAFF is launching on iPhone. Join the waiting list and we{'\u2019'}ll notify you the moment it{'\u2019'}s live {'\u2014'} plus the drop date and first look at the designs.
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={openVIP} style={{ padding:'12px 22px', border:'none', borderRadius:0, background:'#fff', color:'#000',
          fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:'pointer' }}>JOIN THE WAITING LIST</button>
        <button onClick={()=>shareAutograff()} style={{ padding:'12px 20px', borderRadius:0, background:'transparent', color:'#fff',
          border:'1px solid rgba(255,255,255,0.25)', fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:'pointer' }}>{'\u2197'} SHARE</button>
      </div>
      <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:0,
        border:'1px solid rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize:16 }}>{'\uF8FF'}</span>
        <div style={{ textAlign:'left', lineHeight:1.1 }}>
          <div style={{ fontSize:8, color:'#fff', letterSpacing:1 }}>Coming soon on the</div>
          <div style={{ fontFamily:IMP, fontSize:13, letterSpacing:1 }}>App Store</div>
        </div>
      </div>
    </div>
  );
}

function FloatingHearts({ bursts }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:50, overflow:'hidden' }}>
      {bursts.map(h => (
        <svg key={h.id} viewBox="0 0 24 24" width={h.size} height={h.size} aria-hidden="true"
          style={{ position:'absolute', left:h.x, top:h.y,
            '--tx':`${h.tx}px`, '--ty':`${h.ty}px`, '--r':`${h.r}deg`,
            animation:`heartBurst ${h.dur}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
            filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.45))', pointerEvents:'none' }}>
          <path d={HEART_PATH} fill="#ff2d55" />
        </svg>
      ))}
    </div>
  );
}

function LogoButton({ setPage }) {
  return (
    <span onClick={() => setPage('splash')} title="AUTOGRAFF"
      style={{ position:'relative', display:'inline-block', height:'clamp(40px,5vw,64px)', flexShrink:0, cursor:'pointer', transition:'transform 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform='scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
      <img src={LOGO_URI} alt="logo" style={{ height:'100%', width:'auto', display:'block' }} />
    </span>
  );
}

function PageHeader({ setPage, subtitle, right }) {
  return (
    <div style={{ padding:'clamp(10px,1.5vh,18px) clamp(14px,3vw,40px) clamp(8px,1vh,14px)', borderBottom:'1px solid rgba(255,255,255,0.1)',
      display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'clamp(6px,1vw,12px)' }}>
        <LogoButton setPage={setPage} />
        <div>
          <div style={{ fontFamily:IMP, fontSize:'clamp(18px,2.5vw,32px)', color:'#fff', letterSpacing:'-.5px', lineHeight:1, fontWeight:900 }}>AUTOGRAFF</div>
          <div style={{ fontSize:'clamp(10px,1vw,12px)', color:'#fff', letterSpacing:3, textTransform:'uppercase', marginTop:2 }}>{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

/* Instagram-style heart: outline until liked, then filled red. */
function HeartIcon({ filled, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display:'block', filter:'drop-shadow(0 2px 5px rgba(0,0,0,0.4))', transition:'transform 0.2s' }}
      fill={filled ? '#ff2d55' : '#ffffff'} stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* ── PhotoCard (vertical / portrait) ── */
function PhotoCard({ photo, likeCounts, onLike, onRemove, heartBursts, onHeartSpawn }) {
  const [liked, setLiked] = useState(() => hasLiked(photo.id));
  const [pop, setPop] = useState(false);
  const likes = likeCounts[photo.id] ?? photo.likes;
  const fmtLikes = likes >= 1000 ? (likes/1000).toFixed(1)+'K' : likes;

  // Tap anywhere on the photo = love. Every tap bursts hearts at the point and adds a like.
  const love = (e) => {
    const rect = e.currentTarget.closest('[data-card]').getBoundingClientRect();
    setPop(true); setTimeout(() => setPop(false), 200);
    if (!liked) { setLiked(true); markLiked(photo.id); }
    onLike(photo.id);                                    // every tap = +1 love, hearts keep erupting
    if (onHeartSpawn) onHeartSpawn(e.clientX - rect.left, e.clientY - rect.top, 90);
  };
  const handleShare = (e) => {
    e.stopPropagation();
    shareAutograff(`Check out "${photo.title}" on AUTOGRAFF — Share to Win.`);
  };

  return (
    <div data-card className="pc-card" onClick={love} style={{
      width:'clamp(300px,72vw,760px)', aspectRatio:'3 / 2', borderRadius:0, position:'relative', overflow:'hidden',
      flexShrink:0, cursor:'pointer', transition:'transform 0.25s, box-shadow 0.25s',
      boxShadow:'0 6px 30px rgba(0,0,0,0.14)', background:'#111',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='scale(1.01)'; e.currentTarget.style.boxShadow='0 12px 44px rgba(0,0,0,0.22)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 6px 30px rgba(0,0,0,0.14)'; }}
    >
      {photo.type === 'video'
        ? <video src={photo.src} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : <img src={photo.src} alt={photo.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      }
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 22%, transparent 55%, rgba(0,0,0,0.62) 100%)' }} />
      <FloatingHearts bursts={heartBursts || []} />

      {photo.isUpload && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(photo.id); }} style={{
          position:'absolute', top:12, right:12, width:26, height:26, borderRadius:0,
          border:'none', background:'rgba(0,0,0,0.4)', color:'#fff', fontSize:13,
          cursor:'pointer', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
        }}>{'\u2715'}</button>
      )}

      {/* Title + author */}
      <div style={{ position:'absolute', bottom:16, left:18, right:70, zIndex:60 }}>
        <div style={{ fontFamily:IMP, fontSize:'clamp(16px,2.4vw,22px)', color:'#fff', fontWeight:700, textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>{photo.title}</div>
        <div style={{ fontSize:11, color:'#fff', letterSpacing:0.5 }}>@{photo.user}</div>
      </div>

      {/* Subtle like + share overlays */}
      <div style={{ position:'absolute', bottom:16, right:16, display:'flex', flexDirection:'column', alignItems:'center', gap:14, zIndex:60 }}>
        <button onClick={(e)=>{ e.stopPropagation(); love(e); }} title={liked ? 'Liked' : 'Like'} style={{
          background:'transparent', border:'none', cursor:'pointer', padding:0,
          display:'flex', flexDirection:'column', alignItems:'center', gap:2,
        }}>
          <span style={{ display:'block', transform: pop ? 'scale(1.35)' : 'scale(1)', transition:'transform 0.2s cubic-bezier(0.2,1.6,0.4,1)' }}>
            <HeartIcon filled={liked} />
          </span>
          <span style={{ fontFamily:IMP, fontSize:11, color:'#fff', letterSpacing:0.5, textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>{fmtLikes}</span>
        </button>
        <button onClick={handleShare} title="Share" style={{
          background:'transparent', border:'none', cursor:'pointer', padding:0,
          fontSize:22, color:'#fff', filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.5))', lineHeight:1,
        }}>{'\u2197\uFE0F'}</button>
      </div>
    </div>
  );
}

/* ── UploadModal ── */
function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef(null);
  const handleFile = (f) => {
    if (!f) return;
    setUploadError('');
    if (f.size > 25 * 1024 * 1024) { setUploadError('File is too large (25 MB max).'); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const handleSubmit = async () => {
    if (!file || uploading) return;
    setUploading(true); setProgress(0); setUploadError('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const blob = await upload(`uploads/${Date.now()}-${safeName}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ title: title || 'My Upload', user: 'you' }),
        onUploadProgress: (e) => setProgress(e.percentage),
      });
      setProgress(100); setDone(true);
      setTimeout(() => {
        onUpload({ id: Date.now(), src: blob.url, type: file.type.startsWith('video') ? 'video' : 'image',
          title: title || 'My Upload', user: 'you', likes: 0, isUpload: true });
        onClose();
      }, 600);
    } catch (err) {
      setUploading(false); setProgress(0);
      setUploadError(err?.message || 'Upload failed. Please try again.');
    }
  };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#000', borderRadius:0, width:360, maxWidth:'92vw', maxHeight:'calc(100dvh - 32px)', overflowY:'auto', padding:22, position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ fontFamily:IMP, fontSize:15, letterSpacing:2 }}>ADD PHOTO / VIDEO</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#fff' }}>{'\u2715'}</button>
        </div>
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>inputRef.current?.click()}
          style={{ height:180, borderRadius:0, cursor:'pointer', position:'relative', overflow:'hidden',
            border:drag?'2px solid #fff':'2px dashed rgba(255,255,255,0.25)', background:drag?'rgba(255,255,255,0.06)':'transparent',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={e=>handleFile(e.target.files[0])} />
          {preview ? (
            <>{file?.type.startsWith('video')
              ? <video src={preview} autoPlay muted loop playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#111' }} />
              : <img src={preview} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#111' }} />}
              <span style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:9, padding:'3px 8px', borderRadius:0, letterSpacing:1, fontFamily:IMP }}>TAP TO CHANGE</span>
            </>
          ) : (
            <div style={{ textAlign:'center', color:'#fff' }}>
              <div style={{ fontSize:28 }}>{'\uD83D\uDCF7'}</div>
              <div style={{ fontSize:11, marginTop:6 }}>Tap to browse or drag & drop</div>
            </div>
          )}
        </div>
        {file && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'7px 10px', background:'rgba(255,255,255,0.05)', borderRadius:0 }}>
            <span>{file.type.startsWith('video')?'\uD83C\uDFAC':'\uD83D\uDCF7'}</span>
            <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
            <span style={{ fontSize:10, color:'#fff' }}>{(file.size/1024/1024).toFixed(1)} MB</span>
            <button onClick={()=>{setFile(null);setPreview(null)}} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#fff' }}>{'\u2715'}</button>
          </div>
        )}
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)"
          style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(255,255,255,0.2)', borderRadius:0, fontSize:12, marginTop:10, fontFamily:'Georgia,serif', outline:'none' }} />
        <button onClick={handleSubmit} disabled={!file||uploading} style={{
          width:'100%', padding:'11px', marginTop:10, border:'none', borderRadius:0,
          background:file&&!uploading?'#fff':'rgba(255,255,255,0.1)', color:file&&!uploading?'#000':'rgba(255,255,255,0.4)',
          fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:file&&!uploading?'pointer':'default',
        }}>{done?'\u2713 POSTED!':uploading?'UPLOADING...':'POST'}</button>
        {uploadError && <div style={{ color:'#e53935', fontSize:11, marginTop:8, textAlign:'center' }}>{uploadError}</div>}
        {uploading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.92)', borderRadius:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontFamily:IMP, fontSize:15, letterSpacing:2, marginBottom:14 }}>{done?'\u2713 POSTED!':'UPLOADING...'}</div>
            <div style={{ width:'70%', height:4, background:'rgba(255,255,255,0.15)', borderRadius:0, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#fff', borderRadius:0, width:`${progress}%`, transition:'width 0.12s' }} />
            </div>
            <div style={{ marginTop:8, fontSize:11, color:'#fff' }}>{Math.round(progress)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ScrollRow ── */
function ScrollRow({ photos, speed = 0.9, rowHeight: rh = 160, cardWidth: cw = 260, likeCounts = {} }) {
  // Width alone can't mean "desktop": a landscape phone is wide AND short, and would
  // otherwise get the 1.3x upsize on the shortest viewport we support.
  const isWide = typeof window !== 'undefined' && window.innerWidth > 768 && window.innerHeight > 600;
  const cardWidth = isWide ? Math.round(cw * 1.3) : cw;
  const rowHeight = isWide ? Math.round(rh * 1.3) : rh;
  const ref = useRef(null);
  const pauseRef = useRef(false);
  const display = [...photos, ...photos, ...photos];
  useEffect(() => {
    const el = ref.current; if (!el) return; let raf;
    const init = setTimeout(() => {
      el.scrollLeft = el.scrollWidth / 3;
      function step() {
        if (!pauseRef.current) { el.scrollLeft -= speed; if (el.scrollLeft <= 1) el.scrollLeft = el.scrollWidth / 3; }
        raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }, 100);
    return () => { clearTimeout(init); cancelAnimationFrame(raf); };
  }, [speed, photos]);
  return (
    <div ref={ref} onMouseEnter={()=>pauseRef.current=true} onMouseLeave={()=>pauseRef.current=false}
      style={{ display:'flex', gap:12, overflowX:'scroll', scrollbarWidth:'none', padding:'6px 0' }}>
      {display.map((p, i) => (
        <div key={`${p.id}-${i}`} style={{
          width:cardWidth, height:rowHeight, borderRadius:0, flexShrink:0,
          position:'relative', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.08)',
          transition:'transform 0.2s', cursor:'pointer',
        }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <img src={p.src} alt={p.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />
          <div style={{ position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:4, background:'#fff', borderRadius:0, padding:'3px 9px', boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>
            <span style={{ color:'#e53935', fontSize:12 }}>{'\u2764\uFE0F'}</span>
            <span style={{ fontFamily:IMP, fontSize:11, fontWeight:700 }}>{(likeCounts[p.id] ?? p.likes) >= 1000 ? ((likeCounts[p.id]??p.likes)/1000).toFixed(1)+'K' : (likeCounts[p.id]??p.likes)}</span>
          </div>
          <div style={{ position:'absolute', bottom:10, left:10 }}>
            <div style={{ fontFamily:IMP, fontSize:13, color:'#fff', fontWeight:700 }}>{p.title}</div>
            <div style={{ fontSize:9, color:'#fff' }}>@{p.user}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── MemberPortfolio ── */
function MemberPortfolio({ member, onClose, onFollow, isFollowing }) {
  const [tab, setTab] = useState('photos');
  const target = member.rank==='Gold'?10000:member.rank==='Silver'?5000:1000;
  const pct = Math.min(100, Math.round(member.score/target*100));
  const emoji = member.rank==='Gold'?'\uD83E\uDD47':member.rank==='Silver'?'\uD83E\uDD48':'\uD83E\uDD49';
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#000', borderRadius:0, width:420, maxWidth:'92vw', maxHeight:'88vh', overflow:'auto', position:'relative' }}>
        <div style={{ height:80, position:'relative', overflow:'hidden', borderRadius:0, background:'#000' }}>
          {member.posts[0] && <img src={member.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'blur(8px)', opacity:0.4 }} />}
          <button onClick={onClose} style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', width:26, height:26, borderRadius:0, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>{'\u2715'}</button>
        </div>
        <div style={{ display:'flex', justifyContent:'center', marginTop:-32, position:'relative', zIndex:2 }}>
          <div style={{ width:64, height:64, borderRadius:0, border:'3px solid #fff', overflow:'hidden', background:'#eee' }}>
            {member.posts[0] && <img src={member.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
          </div>
        </div>
        <div style={{ textAlign:'center', padding:'6px 18px 0' }}>
          <div style={{ fontFamily:IMP, fontSize:18 }}>{member.name}</div>
          <div style={{ fontSize:11, color:'#fff', marginTop:1 }}>@{member.handle}</div>
          <div style={{ fontSize:11, color:'#fff', marginTop:5 }}>{member.bio}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, margin:'14px clamp(14px,3vw,40px)', background:'rgba(255,255,255,0.1)', borderRadius:0, overflow:'hidden' }}>
          {[{l:'Posts',v:member.posts.length},{l:'Followers',v:member.followers},{l:'Following',v:member.following},{l:'Score',v:member.score}].map(s=>(
            <div key={s.l} style={{ background:'#000', padding:'8px 0', textAlign:'center' }}>
              <div style={{ fontFamily:IMP, fontSize:15 }}>{s.v.toLocaleString()}</div>
              <div style={{ fontSize:8, color:'#fff', letterSpacing:2, textTransform:'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ margin:'0 18px 10px', padding:'8px 12px', background:'#000', borderRadius:0, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>{emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginBottom:3 }}>
              <span>{member.rank}</span><span>{member.score.toLocaleString()}/{target.toLocaleString()}</span>
            </div>
            <div style={{ height:3, background:'rgba(255,255,255,0.15)', borderRadius:0 }}>
              <div style={{ height:'100%', background:'#fff', borderRadius:0, width:`${pct}%`, transition:'width 0.3s' }} />
            </div>
          </div>
        </div>
        <div style={{ padding:'0 18px 10px', display:'flex', justifyContent:'center' }}>
          <button onClick={onFollow} style={{ padding:'7px 28px', borderRadius:0, cursor:'pointer',
            border:isFollowing?'1px solid rgba(255,255,255,0.2)':'none',
            background:isFollowing?'rgba(255,255,255,0.1)':'#fff', color:isFollowing?'#fff':'#000',
            fontFamily:IMP, fontSize:11, letterSpacing:2 }}>{isFollowing?'\u2713 Following':'+ Follow'}</button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.1)', margin:'0 18px' }}>
          {['photos','about'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1, padding:'9px 0', border:'none', background:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:2, textTransform:'uppercase',
              borderBottom:tab===t?'2px solid #fff':'2px solid transparent',
              color:tab===t?'#fff':'rgba(255,255,255,0.4)' }}>{t}</button>
          ))}
        </div>
        <div style={{ padding:16 }}>
          {tab==='photos'?(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {member.posts.map(p=>(
                <div key={p.id} style={{ aspectRatio:'1', borderRadius:0, overflow:'hidden', position:'relative' }}>
                  <img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <span style={{ position:'absolute', bottom:3, left:3, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:8, padding:'2px 5px', borderRadius:0 }}>{'\u2764\uFE0F'} {p.likes}</span>
                </div>
              ))}
            </div>
          ):(
            <div>{[{l:'Handle',v:'@'+member.handle},{l:'Rank',v:member.rank},{l:'Score',v:member.score.toLocaleString()},{l:'Posts',v:member.posts.length},{l:'Followers',v:member.followers.toLocaleString()},{l:'Following',v:member.following}].map(r=>(
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color:'#fff', fontSize:10, letterSpacing:1 }}>{r.l}</span>
                <span style={{ fontFamily:IMP, fontSize:12 }}>{r.v}</span>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ PAGES ══════════════════════════ */

/* ── SplashPage ── */
function SplashPage({ setPage }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 300); }, []);
  return (
    <div style={{
      width:'100%', height:'100%', background:'#000',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        gap:'clamp(28px,5vh,56px)',
        opacity:show?1:0, transition:'opacity 0.8s ease',
      }}>
        <img src="/autograff-logo-white.png" alt="AUTOGRAFF" style={{
          width:'clamp(240px,65vw,500px)', height:'auto', display:'block',
        }} />
        <button
          onClick={()=>setPage('onboard')}
          style={{
            background:'transparent', border:'1px solid rgba(255,255,255,0.4)', borderRadius:0,
            color:'#fff', padding:'12px clamp(40px,10vw,64px)',
            fontFamily:IMP, fontSize:'clamp(12px,3vw,15px)', letterSpacing:6,
            textTransform:'uppercase', cursor:'pointer', minHeight:48,
            transition:'all 0.3s ease', WebkitTapHighlightColor:'transparent',
          }}
          onMouseEnter={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';e.currentTarget.style.letterSpacing='8px'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#fff';e.currentTarget.style.letterSpacing='6px'}}
        >ENTER</button>
        <div style={{ marginTop:-18, textAlign:'center', cursor:'pointer' }} onClick={openVIP}
          title="Tap to join the waiting list">
          <div style={{ fontFamily:HELV, fontSize:'clamp(9px,2.4vw,11px)', letterSpacing:5, color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>Waitlist Number</div>
          <div style={{ fontFamily:IMP, fontSize:'clamp(24px,7vw,40px)', letterSpacing:2, color:'#fff', marginTop:7 }}>#{waitlistNumber()}</div>
        </div>
      </div>
    </div>
  );
}

/* ── PhotosPage ── */
function PhotosPage({ setPage }) {
  const [photos, setPhotos] = useState(SEED_PHOTOS);
  const [likeCounts, setLikeCounts] = useState(()=>{const m={};SEED_PHOTOS.forEach(p=>m[p.id]=p.likes);return m;});
  const [showModal, setShowModal] = useState(false);
  const [heartsByCard, setHeartsByCard] = useState({});
  const scrollRef = useRef(null);
  const pauseRef = useRef(false);
  useEffect(() => {
    let active = true;
    // Load uploaded photos + shared like counts together, then merge deltas onto baselines.
    Promise.all([
      fetch('/api/photos').then(r => r.ok ? r.json() : { photos: [] }).catch(() => ({ photos: [] })),
      fetch('/api/likes').then(r => r.ok ? r.json() : { likes: {} }).catch(() => ({ likes: {} })),
    ]).then(([pd, ld]) => {
      if (!active) return;
      const seedIds = new Set(SEED_PHOTOS.map(p => p.id));
      const uploaded = Array.isArray(pd.photos) ? pd.photos.filter(p => p && p.src && !seedIds.has(p.id)) : [];
      const nextPhotos = uploaded.length ? [...uploaded, ...SEED_PHOTOS] : SEED_PHOTOS;
      if (uploaded.length) setPhotos(nextPhotos);
      const deltas = (ld && ld.likes) || {};
      setLikeCounts(() => {
        const m = {};
        nextPhotos.forEach(p => { m[p.id] = (p.likes || 0) + Number(deltas[p.id] || 0); });
        return m;
      });
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const el=scrollRef.current; if(!el) return; let raf; let last=0; let pos=0;
    const SPEED=42; // px/second — steady conveyor-belt glide
    const init=setTimeout(()=>{
      el.scrollLeft=el.scrollWidth/3; pos=el.scrollLeft;
      function step(t){
        if(!last) last=t; const dt=Math.min((t-last)/1000,0.05); last=t;
        if(!pauseRef.current){
          pos-=SPEED*dt;
          if(pos<=1){pos+=el.scrollWidth/3;}
          el.scrollLeft=pos;
        } else { pos=el.scrollLeft; }
        raf=requestAnimationFrame(step);
      }
      raf=requestAnimationFrame(step);
    },100);
    return()=>{clearTimeout(init);cancelAnimationFrame(raf);};
  },[photos]);
  const handleLike=(id)=>{
    setLikeCounts(p=>({...p,[id]:(p[id]||0)+1}));
    // Persist to KV (shared count) + credit the supporter's ledger score.
    sendLike(id);
  };
  const handleHeartSpawn=(pid,x,y,n)=>{
    const h=makeHeartBurst(x,y,n);
    setHeartsByCard(p=>({...p,[pid]:[...(p[pid]||[]),...h].slice(-450)}));
    setTimeout(()=>setHeartsByCard(p=>({...p,[pid]:(p[pid]||[]).filter(b=>!h.includes(b))})),1300);
  };
  const displayList=[...photos,...photos,...photos];
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      <PageHeader setPage={setPage} subtitle="SHARE TO WIN" right={
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>shareAutograff()}
            style={{ background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.18)',
              width:44, height:44, padding:0, borderRadius:0, fontSize:16, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>{'\uD83D\uDCAC'}</button>
          <button onClick={()=>setShowModal(true)} style={{
            background:'#000', color:'#fff', border:'none', padding:'0 clamp(10px,2vw,16px)', height:44, borderRadius:0,
            fontSize:'clamp(10px,2vw,11px)', cursor:'pointer', fontFamily:IMP, letterSpacing:1,
            flexShrink:0, whiteSpace:'nowrap' }}>+ UPLOAD</button>
        </div>
      } />
      <div style={{ padding:'10px clamp(14px,3vw,40px) 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ fontSize:10, color:'#fff', letterSpacing:2, fontFamily:IMP }}>{'\u2014'} {photos.length} ENTRIES TODAY</span>
        <span style={{ fontSize:9, color:'#fff', letterSpacing:1 }}>Swipe {'\u00B7'} Tap {'\u2764\uFE0F'} to like {'\u00B7'} {'\u2197\uFE0F'} to share</span>
      </div>
      <div className="pc-shelf" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', overflow:'hidden' }}>
        <div ref={scrollRef} className="pc-scroller" onMouseEnter={()=>pauseRef.current=true} onMouseLeave={()=>pauseRef.current=false}
          style={{ display:'flex', gap:18, overflowX:'scroll', scrollbarWidth:'none', padding:'16px clamp(14px,4vw,64px)',
            alignItems:'center' }}>
          {displayList.map((p,i)=>(
            <PhotoCard key={`${p.id}-${i}`} photo={p} likeCounts={likeCounts} onLike={handleLike}
              onRemove={id=>setPhotos(ps=>ps.filter(x=>x.id!==id))}
              heartBursts={heartsByCard[p.id]||[]} onHeartSpawn={(x,y)=>handleHeartSpawn(p.id,x,y)} />
          ))}
        </div>
      </div>
      <div className="pc-cta" style={{ padding:'16px clamp(14px,3vw,40px) calc(124px + env(safe-area-inset-bottom, 0px))', display:'flex', flexDirection:'column', alignItems:'center', gap:10, flexShrink:0 }}>
        <div onClick={()=>setShowModal(true)} style={{
          width:56, height:56, borderRadius:0, border:'2px dashed rgba(255,255,255,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
          color:'#fff', cursor:'pointer' }}>+</div>
        <span style={{ fontSize:10, color:'#fff', letterSpacing:3, fontFamily:IMP }}>DRAG & DROP OR TAP TO UPLOAD</span>
      </div>
      {showModal && <UploadModal onClose={()=>setShowModal(false)} onUpload={photo=>{setPhotos(p=>[photo,...p]);setLikeCounts(p=>({...p,[photo.id]:0}));}} />}
    </div>
  );
}

/* ── LeaderboardPage ── */
function LeaderboardPage({ setPage }) {
  const [view,setView]=useState('photos'); // 'photos' | 'supporters'
  const [voted,setVoted]=useState({});
  const [entries,setEntries]=useState([]);
  const [supporters,setSupporters]=useState([]);
  const me=myRef();
  useEffect(()=>{
    let active=true;
    // The board is the gallery's scoreboard: every curated piece + upload, ranked by real
    // likes, with shares alongside. Polled so a new like/share shows up on its own.
    const load=()=>{
      Promise.all([
        fetch('/api/photos').then(r=>r.ok?r.json():{photos:[]}).catch(()=>({photos:[]})),
        fetch('/api/likes').then(r=>r.ok?r.json():{likes:{},shares:{},likers:{},names:{}}).catch(()=>({likes:{},shares:{},likers:{},names:{}})),
      ]).then(([pd,ld])=>{
        if(!active) return;
        const seedIds=new Set(SEED_PHOTOS.map(p=>p.id));
        const uploaded=Array.isArray(pd.photos)?pd.photos.filter(p=>p&&p.src&&!seedIds.has(p.id)):[];
        const gallery=GALLERY.map(g=>({id:g.id,src:g.src,title:g.title,user:(g.creator||'').replace(/^@/,''),likes:0}));
        const deltas=(ld&&ld.likes)||{}; const shareD=(ld&&ld.shares)||{};
        const all=[...gallery,...uploaded,...SEED_PHOTOS].map(p=>({...p,votes:(p.likes||0)+Number(deltas[p.id]||0),shares:Number(shareD[p.id]||0)}));
        all.sort((a,b)=>b.votes-a.votes);
        setEntries(all);
        const scores=(ld&&ld.likers)||{}; const names=(ld&&ld.names)||{};
        const sup=Object.keys(scores).map(uid=>({uid,score:Number(scores[uid]||0),name:names[uid]||('guest_'+uid)}));
        sup.sort((a,b)=>b.score-a.score);
        setSupporters(sup);
      });
    };
    load();
    const poll=setInterval(load,5000);
    return()=>{active=false;clearInterval(poll);};
  },[]);
  const maxVotes=entries[0]?.votes||1;
  const totalVotes=entries.reduce((s,e)=>s+e.votes,0);
  const totalShares=entries.reduce((s,e)=>s+(e.shares||0),0);
  const maxScore=supporters.reduce((m,s)=>Math.max(m,s.score),1);
  const totalGiven=supporters.reduce((s,e)=>s+e.score,0);
  const handleVote=(id)=>{if(voted[id])return;setVoted(p=>({...p,[id]:true}));
    setEntries(p=>p.map(e=>e.id===id?{...e,votes:e.votes+1}:e).sort((a,b)=>b.votes-a.votes));
    // A vote is a like — persist + credit the supporter ledger.
    sendLike(id);
    setSupporters(p=>{const has=p.some(s=>s.uid===me);
      const next=has?p.map(s=>s.uid===me?{...s,score:s.score+1}:s):[...p,{uid:me,score:1,name:myHandle()}];
      return next.sort((a,b)=>b.score-a.score);});};
  const medal=(i)=>String(i+1).padStart(2,'0');
  const barColor=(i)=>i===0?'#fff':i===1?'rgba(255,255,255,0.55)':i===2?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.25)';
  const fmtV=(v)=>v>=1000?(v/1000).toFixed(1)+'K':v;
  const stagnant=supporters.filter(s=>s.score===0);
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      <PageHeader setPage={setPage} subtitle="THE LEDGER" />
      <div style={{ padding:'6px clamp(14px,3vw,40px) 0', flexShrink:0 }}>
        <p style={{ fontSize:10, color:'#fff', letterSpacing:0.5, margin:'0 0 8px' }}>
          We support the liker, we like the supporter. Give love to climb — lurk and you sink.
        </p>
        <div style={{ display:'flex', gap:6 }}>
          {[{k:'photos',l:'MOST LIKED'},{k:'supporters',l:'TOP SUPPORTERS'}].map(t=>(
            <button key={t.k} onClick={()=>setView(t.k)} style={{
              flex:1, padding:'9px 10px', borderRadius:0, border:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:1,
              background:view===t.k?'#fff':'rgba(255,255,255,0.08)', color:view===t.k?'#000':'rgba(255,255,255,0.6)',
              transition:'all 0.2s' }}>{t.l}</button>
          ))}
        </div>
      </div>

      {view==='photos' ? (
        <div style={{ flex:1, overflow:'auto', padding:'8px 18px 190px' }}>
          {entries.map((e,i)=>{
            const key=e.id;const pct=Math.round(e.votes/maxVotes*100);
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ width:28, fontFamily:IMP, fontSize:i<3?14:16, textAlign:'center', color:i<3?'inherit':'rgba(255,255,255,0.5)' }}>{medal(i)}</span>
                <div style={{ width:60, height:44, borderRadius:0, overflow:'hidden', flexShrink:0 }}>
                  <img src={e.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>{e.title}</div>
                  <div style={{ fontSize:10, color:'#fff' }}>@{e.user}</div>
                  <div style={{ height:3, background:'rgba(255,255,255,0.12)', borderRadius:0, marginTop:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:barColor(i), borderRadius:0, width:`${pct}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
                <div style={{ textAlign:'right', minWidth:40 }}>
                  <div style={{ fontFamily:IMP, fontSize:15, fontWeight:700 }}>{fmtV(e.votes)}</div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:2 }}>LIKES</div>
                </div>
                <div style={{ textAlign:'right', minWidth:38 }}>
                  <div style={{ fontFamily:IMP, fontSize:15, fontWeight:700, color:'#cfcfcf' }}>{fmtV(e.shares||0)}</div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:2 }}>SHARES</div>
                </div>
                <button onClick={()=>handleVote(e.id)} disabled={!!voted[key]} style={{
                  padding:'6px 12px', borderRadius:0, fontSize:10, cursor:voted[key]?'default':'pointer',
                  fontFamily:IMP, letterSpacing:1,
                  background:voted[key]?'rgba(255,255,255,0.1)':'transparent',
                  border:`1px solid ${voted[key]?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.35)'}`,
                  color:voted[key]?'rgba(255,255,255,0.5)':'#fff' }}>{voted[key]?'LIKED':'LIKE'}</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex:1, overflow:'auto', padding:'8px 18px 190px' }}>
          {supporters.filter(s=>s.score>0).length===0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#fff', fontSize:12 }}>
              No supporters yet. Be the first to give love — go like some photos.
            </div>
          )}
          {supporters.filter(s=>s.score>0).map((s,i)=>{
            const pct=Math.round(s.score/maxScore*100); const mine=s.uid===me;
            return (
              <div key={s.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ width:28, fontFamily:IMP, fontSize:i<3?14:16, textAlign:'center', color:i<3?'inherit':'rgba(255,255,255,0.5)' }}>{medal(i)}</span>
                <div style={{ width:44, height:44, borderRadius:0, flexShrink:0, background:i===0?'#fff':'rgba(255,255,255,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontFamily:IMP, fontSize:16,
                  color:i===0?'#000':'rgba(255,255,255,0.7)' }}>{(s.name||'?').replace(/^guest_/,'').slice(0,2).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>@{s.name}{mine&&<span style={{ fontSize:9, color:'#3ad07a', marginLeft:6 }}>YOU</span>}</div>
                  <div style={{ fontSize:10, color:'#fff' }}>{i===0?'Patron of the day':'Supporter'}</div>
                  <div style={{ height:3, background:'rgba(255,255,255,0.12)', borderRadius:0, marginTop:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:barColor(i), borderRadius:0, width:`${pct}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
                <div style={{ textAlign:'right', minWidth:44 }}>
                  <div style={{ fontFamily:IMP, fontSize:15, fontWeight:700 }}>{fmtV(s.score)}</div>
                  <div style={{ fontSize:8, color:'#fff', letterSpacing:2 }}>GIVEN</div>
                </div>
              </div>
            );
          })}
          {stagnant.length>0 && (
            <div style={{ marginTop:18, padding:'14px 16px', borderRadius:0, background:'rgba(229,57,53,0.06)', border:'1px dashed rgba(229,57,53,0.35)' }}>
              <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:1, color:'#e53935' }}>THE STAGNANT ({stagnant.length})</div>
              <div style={{ fontSize:10, color:'#fff', margin:'4px 0 8px' }}>Showed up, watched the show, never gave a like. Zero love. Do better.</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {stagnant.map(s=>(
                  <span key={s.uid} style={{ fontSize:10, fontFamily:IMP, letterSpacing:0.5, padding:'4px 8px', borderRadius:0,
                    background:s.uid===me?'#e53935':'rgba(255,255,255,0.08)', color:s.uid===me?'#fff':'rgba(255,255,255,0.6)' }}>
                    @{s.name}{s.uid===me?' (YOU)':''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position:'absolute', bottom:'calc(118px + env(safe-area-inset-bottom, 0px))', left:0, right:0, padding:'20px clamp(14px,3vw,40px) 8px',
        background:'linear-gradient(transparent, rgba(0,0,0,0.9) 35%, #000)',
        display:'flex', justifyContent:'space-around', zIndex:10 }}>
        {(view==='photos'
          ? [{l:'TOTAL LIKES',v:fmtV(totalVotes)},{l:'TOTAL SHARES',v:fmtV(totalShares)},{l:'TOP',v:entries[0]?.title||'-'}]
          : [{l:'LOVE GIVEN',v:fmtV(totalGiven)},{l:'TOP PATRON',v:supporters[0]?'@'+supporters[0].name:'-'},{l:'STAGNANT',v:stagnant.length}]
        ).map(s=>(
          <div key={s.l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:8, color:'#fff', letterSpacing:2, fontFamily:IMP }}>{s.l}</div>
            <div style={{ fontFamily:IMP, fontSize:13, marginTop:2 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════ CURATED GALLERY — horizontal-first, gamified, gallery-grade ══════════════ */
const CATEGORIES = ['Graffiti','Automotive','Photography','Architecture','Gaming','Film','Digital Art','Fashion','Street Culture','Music Videos','Paintings','Murals'];
const GALLERY = [
  { id:'art-of-living',   src:'/gallery/mural-art-of-living.jpg', title:'The Art of Living',      category:'Murals',    creator:'@autograff' },
  { id:'poetic-rhetoric', src:'/gallery/poetic-rhetoric.jpg',     title:'Poetic Rhetoric, Pt. 2', category:'Paintings', creator:'@autograff' },
  { id:'wildstyle',       src:'/gallery/graffiti-wildstyle.jpg',  title:'Wildstyle',              category:'Graffiti',  creator:'@autograff' },
];
const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'K' : (n || 0));

/* Seamless marquee — two identical, viewport-wide tracks translated -50%. No skips, no gaps. */
function Marquee({ text, dur, bg, color, size }) {
  const t = (text + '').repeat(3);
  const sp = { fontFamily:IMP, fontSize:size || 11, letterSpacing:3, color:color || '#fff', display:'inline-block', whiteSpace:'pre' };
  return (
    <div style={{ background:bg || 'transparent', overflow:'hidden', whiteSpace:'pre', flexShrink:0, borderTop:'1px solid rgba(255,255,255,0.08)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display:'inline-flex', animation:'marqueeText ' + (dur || 30) + 's linear infinite', willChange:'transform', padding:'9px 0' }}>
        <span style={sp}>{t}</span>
        <span style={sp} aria-hidden="true">{t}</span>
      </div>
    </div>
  );
}

/* 16:9 card on the conveyor. TAP = pop it up (lightbox); the heart = multi-tap love, hundreds
   of hearts erupt; share = share. DRAG scrolls. No accidental profile jump. Sharp corners. */
function GalleryCard({ item, counts, onView, onLove, onShare }) {
  const [bursts, setBursts] = useState([]);
  const [loved, setLoved] = useState(() => hasLiked(item.id));
  const g = useRef({ moved:false, skip:false, sx:0, sy:0 });
  const c = counts || { likes:0, shares:0 };
  const love = (e) => {
    e.stopPropagation();
    if (!loved) { setLoved(true); markLiked(item.id); }
    onLove(item.id);
    const el = e.currentTarget.closest('[data-gcard]'); const r = el.getBoundingClientRect();
    const parts = makeHeartBurst(e.clientX - r.left, e.clientY - r.top, 90);
    setBursts(prev => [...prev, ...parts].slice(-450));
    setTimeout(() => setBursts(prev => prev.filter(p => !parts.includes(p))), 1500);
  };
  const share = (e) => { e.stopPropagation(); onShare(item); };
  const down = (e) => { const s2=g.current; s2.skip = !!(e.target.closest && e.target.closest('button')); s2.moved=false; s2.sx=e.clientX; s2.sy=e.clientY; };
  const move = (e) => { const s2=g.current; if (Math.abs(e.clientX-s2.sx)>10 || Math.abs(e.clientY-s2.sy)>10) s2.moved=true; };
  const up = () => { const s2=g.current; if (!s2.skip && !s2.moved) onView(item); };
  return (
    <div data-gcard role="button" tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onMouseEnter={e => { const cc=e.currentTarget; cc.style.transform='scale(1.035)'; cc.style.boxShadow='0 28px 66px rgba(0,0,0,0.72)'; cc.style.filter='brightness(1.07)'; }}
      onMouseLeave={e => { const cc=e.currentTarget; cc.style.transform='scale(1)'; cc.style.boxShadow='0 4px 18px rgba(0,0,0,0.45)'; cc.style.filter='none'; }}
      style={{ width:'clamp(260px,74vw,600px)', aspectRatio:'16 / 9', flexShrink:0, position:'relative', overflow:'hidden', borderRadius:0, cursor:'pointer', background:'#070707', userSelect:'none', WebkitUserSelect:'none', WebkitTapHighlightColor:'transparent', boxShadow:'0 4px 18px rgba(0,0,0,0.45)', transition:'transform .34s cubic-bezier(.2,.7,.2,1), box-shadow .34s ease, filter .34s ease' }}>
      <img src={item.src} alt={item.title} loading="lazy" draggable={false} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', background:'#070707', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(180deg, transparent 44%, rgba(0,0,0,0.82) 100%)' }} />
      <FloatingHearts bursts={bursts} />
      <div style={{ position:'absolute', left:16, right:92, bottom:14, pointerEvents:'none' }}>
        <div style={{ fontFamily:HELV, fontSize:9, letterSpacing:3, color:'#c9c9c9', textTransform:'uppercase', marginBottom:4 }}>{item.category}</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(15px,3.2vw,21px)', color:'#fff', letterSpacing:0.4, lineHeight:1 }}>{item.title}</div>
        <div style={{ fontFamily:HELV, fontSize:10, letterSpacing:1, color:'#8f8f8f', marginTop:5 }}>{item.creator}</div>
      </div>
      <div style={{ position:'absolute', right:14, bottom:14, display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
        <button onClick={love} title="Love" style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <HeartIcon filled={loved} size={30} />
          <span style={{ fontFamily:IMP, fontSize:11, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.65)' }}>{fmtN(c.likes)}</span>
        </button>
        <button onClick={share} title="Share" style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <span style={{ fontSize:21, color:'#fff', lineHeight:1, filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>↗</span>
          <span style={{ fontFamily:IMP, fontSize:11, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.65)' }}>{fmtN(c.shares)}</span>
        </button>
      </div>
    </div>
  );
}

/* Conveyor belt — drifts on its own via a fractional accumulator (works on mobile, where
   reading scrollLeft floors sub-pixels). Pauses on touch/hover; swipe (touch) or drag (mouse). */
function FeaturedRail({ items, counts, onView, onLove, onShare }) {
  const ref = useRef(null);
  const pause = useRef(false);
  const drag = useRef({ on:false, sx:0, sl:0 });
  const loop = items.length > 1 ? [...items, ...items, ...items] : items;
  useEffect(() => {
    const el = ref.current; if (!el || items.length < 2) return;
    let raf, pos = 0;
    const init = setTimeout(() => {
      pos = el.scrollWidth / 3; el.scrollLeft = pos;
      const step = () => {
        if (pause.current) { pos = el.scrollLeft; }
        else { pos += 0.25; if (pos >= (el.scrollWidth * 2) / 3) pos -= el.scrollWidth / 3; el.scrollLeft = pos; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 160);
    return () => { clearTimeout(init); cancelAnimationFrame(raf); };
  }, [items]);
  const down = (e) => { pause.current = true; if (e.pointerType === 'mouse' && ref.current) drag.current = { on:true, sx:e.clientX, sl:ref.current.scrollLeft }; };
  const move = (e) => { if (drag.current.on && ref.current) ref.current.scrollLeft = drag.current.sl - (e.clientX - drag.current.sx); };
  const end = () => { drag.current.on = false; setTimeout(() => { pause.current = false; }, 1400); };
  return (
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onMouseEnter={() => { pause.current = true; }} onMouseLeave={() => { drag.current.on = false; pause.current = false; }}
      style={{ display:'flex', gap:'clamp(12px,2vw,20px)', overflowX:'auto', scrollbarWidth:'none', padding:'6px clamp(14px,3vw,40px) 22px', WebkitOverflowScrolling:'touch', cursor:'grab' }}>
      {loop.map((item, i) => <GalleryCard key={item.id + '-' + i} item={item} counts={counts[item.id]} onView={onView} onLove={onLove} onShare={onShare} />)}
    </div>
  );
}

/* Cinematic hero — smaller, shows the FULL art (contain), cross-fades through the works. */
function GalleryHero({ items, onOpen }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (items.length < 2) return; const t = setInterval(() => setIdx(i => (i + 1) % items.length), 5400); return () => clearInterval(t); }, [items.length]);
  const cur = items[idx] || items[0];
  if (!cur) return null;
  return (
    <div style={{ position:'relative', width:'100%', height:'clamp(150px,26vh,400px)', overflow:'hidden', background:'#000', flexShrink:0 }}>
      {items.map((it, i) => (
        <div key={it.id} aria-hidden={i!==idx} style={{ position:'absolute', inset:0, opacity:i===idx?1:0, transition:'opacity 1.2s ease' }}>
          <img src={it.src} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'blur(34px) brightness(0.42)', transform:'scale(1.18)' }} />
          <img src={it.src} alt={it.title} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' }} />
        </div>
      ))}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(180deg, rgba(0,0,0,0.26) 0%, transparent 22%, transparent 54%, rgba(0,0,0,0.88) 100%)' }} />
      <div style={{ position:'absolute', left:'clamp(16px,4vw,52px)', right:'clamp(16px,4vw,52px)', bottom:'clamp(14px,3vh,34px)' }}>
        <div style={{ fontFamily:HELV, fontSize:10, letterSpacing:4, color:'#d8d8d8', textTransform:'uppercase', marginBottom:6 }}>{cur.category}</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(22px,6vw,50px)', color:'#fff', letterSpacing:0.5, lineHeight:0.98, maxWidth:640 }}>{cur.title}</div>
        <button onClick={() => onOpen(cur)} style={{ marginTop:11, background:'#fff', color:'#000', border:'none', borderRadius:0, padding:'10px 24px', fontFamily:IMP, fontSize:12, letterSpacing:2, cursor:'pointer' }}>VIEW</button>
      </div>
      {items.length > 1 && (
        <div style={{ position:'absolute', right:'clamp(16px,4vw,52px)', top:'clamp(12px,2.5vh,24px)', display:'flex', gap:6 }}>
          {items.map((_, i) => <span key={i} style={{ width:i===idx?18:6, height:6, background:i===idx?'#fff':'rgba(255,255,255,0.4)', transition:'all .4s' }} />)}
        </div>
      )}
    </div>
  );
}

/* The pop-up — the full work on black. Love it as many times as you want (hearts erupt),
   share it, and enter the artist's profile only when you deliberately tap their name. */
function GalleryLightbox({ item, counts, onClose, onLove, onShare, onCreator }) {
  const [bursts, setBursts] = useState([]);
  const [loved, setLoved] = useState(() => hasLiked(item.id));
  if (!item) return null;
  const c = counts || { likes:0, shares:0 };
  const love = (e) => {
    e.stopPropagation();
    if (!loved) { setLoved(true); markLiked(item.id); }
    onLove(item.id);
    const host = e.currentTarget.closest('[data-lb]'); const r = host.getBoundingClientRect();
    const parts = makeHeartBurst(e.clientX - r.left, e.clientY - r.top, 120);
    setBursts(prev => [...prev, ...parts].slice(-500));
    setTimeout(() => setBursts(prev => prev.filter(p => !parts.includes(p))), 1500);
  };
  return (
    <div data-lb onClick={onClose} style={{ position:'fixed', inset:0, zIndex:700, background:'rgba(0,0,0,0.96)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'clamp(16px,4vw,48px)', overflow:'hidden' }}>
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:34, height:34, borderRadius:0, border:'1px solid rgba(255,255,255,0.3)', background:'transparent', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>✕</button>
      <img src={item.src} alt={item.title} onClick={e=>e.stopPropagation()} style={{ maxWidth:'96vw', maxHeight:'58vh', objectFit:'contain', boxShadow:'0 30px 90px rgba(0,0,0,0.85)' }} />
      <FloatingHearts bursts={bursts} />
      <div onClick={e=>e.stopPropagation()} style={{ marginTop:16, textAlign:'center', maxWidth:520 }}>
        <div style={{ fontFamily:HELV, fontSize:10, letterSpacing:4, color:'#b3b3b3', textTransform:'uppercase', marginBottom:6 }}>{item.category}</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(20px,4vw,30px)', color:'#fff', letterSpacing:0.5 }}>{item.title}</div>
        <button onClick={() => onCreator(item.creator)} style={{ marginTop:8, background:'none', border:'none', color:'#9a9a9a', fontFamily:HELV, fontSize:12, letterSpacing:1, cursor:'pointer' }}>{item.creator} →</button>
        <div style={{ display:'flex', gap:24, justifyContent:'center', marginTop:16 }}>
          <button onClick={love} title="Love" style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <HeartIcon filled={loved} size={34} />
            <span style={{ fontFamily:IMP, fontSize:12, color:'#fff' }}>{fmtN(c.likes)}</span>
          </button>
          <button onClick={() => onShare(item)} title="Share" style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:26, color:'#fff', lineHeight:1 }}>↗</span>
            <span style={{ fontFamily:IMP, fontSize:12, color:'#fff' }}>{fmtN(c.shares)}</span>
          </button>
        </div>
        <div style={{ fontFamily:HELV, fontSize:10, letterSpacing:1, color:'#6a6a6a', marginTop:12 }}>Tap the heart — love it as many times as you want</div>
      </div>
    </div>
  );
}

/* Creator profile — their works + total love. */
function CreatorProfile({ handle, counts, onClose, onOpen }) {
  const works = GALLERY.filter(w => w.creator === handle);
  const loves = works.reduce((s2, w) => s2 + ((counts[w.id] && counts[w.id].likes) || 0), 0);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:680, background:'rgba(0,0,0,0.96)', overflowY:'auto', padding:'clamp(24px,6vw,64px) clamp(16px,4vw,48px)' }}>
      <button onClick={onClose} style={{ position:'fixed', top:16, right:16, width:34, height:34, borderRadius:0, border:'1px solid rgba(255,255,255,0.3)', background:'transparent', color:'#fff', fontSize:16, cursor:'pointer', zIndex:2 }}>✕</button>
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:960, margin:'0 auto' }}>
        <div style={{ fontFamily:HELV, fontSize:10, letterSpacing:4, color:'#b3b3b3', textTransform:'uppercase' }}>Creator</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(30px,7vw,54px)', color:'#fff', letterSpacing:0.5, marginTop:6 }}>{handle}</div>
        <div style={{ display:'flex', gap:34, marginTop:18 }}>
          <div><div style={{ fontFamily:IMP, fontSize:24, color:'#fff' }}>{works.length}</div><div style={{ fontFamily:HELV, fontSize:9, letterSpacing:2, color:'#8f8f8f', textTransform:'uppercase' }}>Works</div></div>
          <div><div style={{ fontFamily:IMP, fontSize:24, color:'#ff2d55' }}>{fmtN(loves)}</div><div style={{ fontFamily:HELV, fontSize:9, letterSpacing:2, color:'#8f8f8f', textTransform:'uppercase' }}>Loves</div></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14, marginTop:32 }}>
          {works.map(w => (
            <button key={w.id} onClick={() => onOpen(w)} style={{ aspectRatio:'16 / 9', border:'none', padding:0, background:'#070707', cursor:'pointer', position:'relative', overflow:'hidden' }}>
              <img src={w.src} alt={w.title} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.75) 100%)' }} />
              <div style={{ position:'absolute', left:12, bottom:10, fontFamily:IMP, fontSize:14, color:'#fff' }}>{w.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── GuestPage — the cinematic, gamified gallery homepage ── */
function GuestPage({ setPage }) {
  const [lightbox, setLightbox] = useState(null);
  const [creator, setCreator] = useState(null);
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let active = true;
    fetch('/api/likes').then(r => r.ok ? r.json() : {}).then(d => {
      if (!active) return;
      const L = (d && d.likes) || {}, S = (d && d.shares) || {}; const m = {};
      GALLERY.forEach(gg => { m[gg.id] = { likes:Number(L[gg.id] || 0), shares:Number(S[gg.id] || 0) }; });
      setCounts(m);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const onLove = (id) => { setCounts(p => ({ ...p, [id]: { likes:(((p[id]||{}).likes)||0)+1, shares:((p[id]||{}).shares)||0 } })); sendLike(id, 1); };
  const onShare = (item) => {
    setCounts(p => ({ ...p, [item.id]: { likes:((p[item.id]||{}).likes)||0, shares:(((p[item.id]||{}).shares)||0)+1 } }));
    sendShare(item.id); shareAutograff('Check out "' + item.title + '" ' + item.creator + ' on AUTOGRAFF');
  };
  const ranked = [...GALLERY].sort((x, y) => (((counts[y.id]||{}).likes)||0) - (((counts[x.id]||{}).likes)||0));
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000', overflow:'auto' }}>
      <PageHeader setPage={setPage} subtitle="GALLERY" right={
        <button onClick={openVIP} style={{ background:'#fff', color:'#000', border:'none', padding:'9px 18px', borderRadius:0, fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer' }}>REQUEST ACCESS</button>
      } />
      <Marquee bg="#0b0b0b" dur={80} text={'YOU’RE #' + waitlistNumber() + ' IN LINE FOR AUTOGRAFF      —      INVITATION-ONLY, EARNED NOT BOUGHT      —      CLAIM YOUR SPOT BEFORE THE DOORS CLOSE      —      '} />
      <GalleryHero items={GALLERY} onOpen={setLightbox} />
      <Marquee dur={90} color="#cfcfcf" text={CATEGORIES.map(c => c.toUpperCase()).join('      ·      ') + '      ·      '} />
      <div style={{ padding:'10px 0 2px clamp(14px,3vw,40px)', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:3, marginBottom:8, color:'#fff' }}>— MOST LOVED</div>
        <FeaturedRail items={ranked} counts={counts} onView={setLightbox} onLove={onLove} onShare={onShare} />
      </div>
      <div style={{ margin:'8px clamp(14px,3vw,40px) 110px', borderTop:'1px solid rgba(255,255,255,0.12)', paddingTop:28, flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:'clamp(20px,5vw,30px)', color:'#fff', letterSpacing:0.5, lineHeight:1.05, maxWidth:520 }}>A gallery for work made to be seen.</div>
        <div style={{ fontFamily:HELV, fontSize:13, color:'#9a9a9a', marginTop:12, lineHeight:1.6, maxWidth:460 }}>AUTOGRAFF is a curated, invitation-only home for graffiti, murals, photography, automotive, film and the culture around them — presented the way it was meant to be viewed.</div>
        <button onClick={openVIP} style={{ marginTop:20, background:'#fff', color:'#000', border:'none', borderRadius:0, padding:'13px 30px', fontFamily:IMP, fontSize:12, letterSpacing:2, cursor:'pointer' }}>REQUEST ACCESS</button>
      </div>
      {lightbox && <GalleryLightbox item={lightbox} counts={counts[lightbox.id]} onClose={() => setLightbox(null)} onLove={onLove} onShare={onShare} onCreator={(h) => { setLightbox(null); setCreator(h); }} />}
      {creator && <CreatorProfile handle={creator} counts={counts} onClose={() => setCreator(null)} onOpen={(w) => { setCreator(null); setLightbox(w); }} />}
    </div>
  );
}

/* ── MembersPage ── */
function MembersPage({ setPage }) {
  const [filter,setFilter]=useState('All');
  const [following,setFollowing]=useState({});
  const [portfolio,setPortfolio]=useState(null);
  const [search,setSearch]=useState('');
  const filters=['All','Gold','Silver','Bronze'];
  const members=MOCK_MEMBERS
    .filter(m=>filter==='All'||m.rank===filter)
    .filter(m=>!search||m.name.toLowerCase().includes(search.toLowerCase())||m.handle.toLowerCase().includes(search.toLowerCase()));
  const rankEmoji=(r)=>r==='Gold'?'\uD83E\uDD47':r==='Silver'?'\uD83E\uDD48':'\uD83E\uDD49';
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      <PageHeader setPage={setPage} subtitle="MEMBERS" />
      <div style={{ padding:'12px clamp(14px,3vw,40px) 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'rgba(255,255,255,0.05)', borderRadius:0, border:'1px solid rgba(255,255,255,0.12)' }}>
          <span style={{ color:'#fff' }}>{'\uD83D\uDD0D'}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..."
            style={{ flex:1, border:'none', background:'none', color:'#fff', fontSize:12, outline:'none', fontFamily:'Georgia,serif' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:6, padding:'10px 18px', flexShrink:0, alignItems:'center' }}>
        {filters.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'5px 12px', borderRadius:0, border:filter===f?'none':'1px solid rgba(255,255,255,0.2)', cursor:'pointer',
            fontFamily:IMP, fontSize:10, letterSpacing:1,
            background:filter===f?'#fff':'transparent', color:filter===f?'#000':'rgba(255,255,255,0.5)',
          }}>{f!=='All'?rankEmoji(f)+' ':''}{f.toUpperCase()}</button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', fontFamily:IMP, letterSpacing:1 }}>{members.length} MEMBERS</span>
      </div>
      <div style={{ flex:1, overflow:'auto', padding:'0 clamp(14px,3vw,40px) 100px' }}>
        {members.map(m=>(
          <div key={m.id} onClick={()=>setPortfolio(m)} style={{
            display:'flex', alignItems:'center', gap:10, padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.1)', cursor:'pointer',
          }}>
            <div style={{ width:56, height:56, borderRadius:0, overflow:'hidden', background:'#eee', flexShrink:0, border:'2px solid rgba(255,255,255,0.1)' }}>
              {m.posts[0] && <img src={m.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>{m.name}</span>
                <span style={{ fontSize:12 }}>{rankEmoji(m.rank)}</span>
              </div>
              <div style={{ fontSize:10, color:'#fff' }}>@{m.handle}</div>
              <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>{m.bio}</div>
              <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10 }}>
                <span><b>{m.posts.length}</b> <span style={{ color:'#fff' }}>Posts</span></span>
                <span><b>{m.followers >= 1000 ? (m.followers/1000).toFixed(1)+'K' : m.followers}</b> <span style={{ color:'#fff' }}>Followers</span></span>
                <span><b>{m.score >= 1000 ? (m.score/1000).toFixed(1)+'K' : m.score}</b> <span style={{ color:'#fff' }}>Score</span></span>
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();setFollowing(p=>({...p,[m.id]:!p[m.id]}))}} style={{
              padding:'0 clamp(10px,2vw,16px)', height:44, borderRadius:0, fontSize:10, cursor:'pointer',
              fontFamily:IMP, letterSpacing:1, flexShrink:0,
              background:following[m.id]?'rgba(255,255,255,0.1)':'#fff', color:following[m.id]?'#fff':'#000',
              border:following[m.id]?'1px solid rgba(255,255,255,0.25)':'none',
              display:'flex', alignItems:'center',
            }}>{following[m.id]?'\u2713':'+FOLLOW'}</button>
          </div>
        ))}
      </div>
      {portfolio && <MemberPortfolio member={portfolio} onClose={()=>setPortfolio(null)}
        isFollowing={!!following[portfolio.id]}
        onFollow={()=>setFollowing(p=>({...p,[portfolio.id]:!p[portfolio.id]}))} />}
    </div>
  );
}

/* ── StudioPage ── */
function StudioPage({ setPage }) {
  const [playing,setPlaying]=useState(false);
  const [bpm,setBpm]=useState(120);
  const [swing,setSwing]=useState(0);
  const [patterns,setPatterns]=useState(()=>{const p={};TRACK_DEFS.forEach(t=>p[t.id]=new Array(16).fill(false));return p;});
  const [muted,setMuted]=useState({});
  const [solo,setSolo]=useState(null);
  const [volumes,setVolumes]=useState(()=>{const v={};TRACK_DEFS.forEach(t=>v[t.id]=t.vol);return v;});
  const [saved,setSaved]=useState([]);
  const [showSave,setShowSave]=useState(false);
  const [saveName,setSaveName]=useState('');
  const [activePreset,setActivePreset]=useState(null);
  const [currentStep,setCurrentStep]=useState(-1);
  const ctxRef=useRef(null); const timerRef=useRef(null); const stepRef=useRef(0);
  const nextTimeRef=useRef(0); const bpmRef=useRef(bpm); const patRef=useRef(patterns);
  const mutRef=useRef(muted); const soloRef=useRef(solo); const volRef=useRef(volumes); const swingRef=useRef(swing);
  useEffect(()=>{bpmRef.current=bpm},[bpm]); useEffect(()=>{patRef.current=patterns},[patterns]);
  useEffect(()=>{mutRef.current=muted},[muted]); useEffect(()=>{soloRef.current=solo},[solo]);
  useEffect(()=>{volRef.current=volumes},[volumes]); useEffect(()=>{swingRef.current=swing},[swing]);
  const start=()=>{
    if(!ctxRef.current) ctxRef.current=new(window.AudioContext||window.webkitAudioContext)();
    const ctx=ctxRef.current; if(ctx.state==='suspended')ctx.resume();
    stepRef.current=0; nextTimeRef.current=ctx.currentTime+0.05; setPlaying(true);
    const schedule=()=>{
      while(nextTimeRef.current<ctxRef.current.currentTime+0.1){
        const step=stepRef.current; const sps=(60/bpmRef.current)/4;
        const so=(step%2===1)?(swingRef.current/100*sps*0.5):0;
        const time=nextTimeRef.current+so; setCurrentStep(step);
        TRACK_DEFS.forEach(track=>{
          if(patRef.current[track.id]?.[step]){
            const m=mutRef.current[track.id]; const hasSolo=soloRef.current!==null;
            if(!m&&(!hasSolo||soloRef.current===track.id)) playSound(ctxRef.current,track,time,volRef.current[track.id]??track.vol);
          }
        });
        nextTimeRef.current+=sps; stepRef.current=(stepRef.current+1)%16;
      }
      timerRef.current=setTimeout(schedule,20);
    };
    schedule();
  };
  const stop=()=>{setPlaying(false);setCurrentStep(-1);if(timerRef.current)clearTimeout(timerRef.current);};
  useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current);},[]);
  const loadPreset=(name)=>{const pr=PRESETS[name];if(!pr)return;stop();
    const p={};TRACK_DEFS.forEach(t=>p[t.id]=(pr.patterns[t.id]||new Array(16).fill(0)).map(v=>!!v));
    // Sync refs synchronously so the scheduler plays the new beat immediately.
    setPatterns(p); patRef.current=p;
    setBpm(pr.bpm); bpmRef.current=pr.bpm;
    setSwing(pr.swing); swingRef.current=pr.swing;
    setActivePreset(name);
    start(); // clicking a preset is a user gesture, so audio can start out loud
  };
  const clearAll=()=>{stop();setActivePreset(null);const p={};TRACK_DEFS.forEach(t=>p[t.id]=new Array(16).fill(false));setPatterns(p);};
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      <PageHeader setPage={setPage} subtitle="STUDIO \u00B7 LOOP MIXER" right={
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={clearAll} style={{ padding:'8px 14px', borderRadius:0, border:'1px solid rgba(255,255,255,0.18)',
            background:'#000', color:'#fff', fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer' }}>CLEAR</button>
          <button onClick={playing?stop:start} style={{ padding:'8px clamp(14px,3vw,40px)', borderRadius:0, border:'none',
            background:'rgba(255,255,255,0.14)', color:'#fff', fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#4fc3f7', fontSize:14 }}>{playing?'\u23F9':'\u25B6'}</span>
            {playing?'STOP':'PLAY'}
          </button>
        </div>
      } />
      {/* Transport */}
      <div style={{ padding:'8px clamp(14px,3vw,40px)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontFamily:IMP, fontSize:10, letterSpacing:2, color:'#fff' }}>BPM</span>
        <button onClick={()=>setBpm(Math.max(60,bpm-5))} style={{ width:26, height:26, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', background:'#000', color:'#fff', cursor:'pointer', fontSize:13, fontFamily:IMP }}>{'\u2212'}</button>
        <span style={{ fontFamily:IMP, fontSize:18, minWidth:36, textAlign:'center', fontWeight:700 }}>{bpm}</span>
        <button onClick={()=>setBpm(Math.min(200,bpm+5))} style={{ width:26, height:26, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', background:'#000', color:'#fff', cursor:'pointer', fontSize:13, fontFamily:IMP }}>+</button>
        <span style={{ fontFamily:IMP, fontSize:10, letterSpacing:2, color:'#fff', marginLeft:6 }}>SWING</span>
        <input type="range" min="0" max="80" value={swing} onChange={e=>setSwing(Number(e.target.value))} style={{ width:60 }} />
        <span style={{ fontFamily:IMP, fontSize:11 }}>{swing}%</span>
      </div>
      {/* Genre presets — tap to load & auto-play out loud */}
      <div style={{ padding:'8px clamp(14px,3vw,40px)', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontFamily:IMP, fontSize:10, letterSpacing:2, color:'#fff' }}>{'\uD83C\uDFB5'} GENRE PRESETS</span>
          <span style={{ fontSize:9, color:'#fff', letterSpacing:1 }}>Tap a genre — it plays instantly {'\u25B6'}</span>
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          {Object.keys(PRESETS).map(n=>{
            const on=activePreset===n&&playing;
            return (
              <button key={n} onClick={()=>loadPreset(n)} style={{
                flexShrink:0, padding:'8px 14px', borderRadius:0, cursor:'pointer',
                border:on?'1px solid #000':'1px solid rgba(0,0,0,0.12)',
                background:on?'rgba(255,255,255,0.18)':'#fff', color:on?'#fff':'#000',
                fontSize:10, fontFamily:IMP, letterSpacing:1, whiteSpace:'nowrap',
                display:'flex', alignItems:'center', gap:5, transition:'all 0.15s' }}>
                <span style={{ fontSize:9, color:on?'#4fc3f7':'rgba(0,0,0,0.35)' }}>{on?'\u25B6':'\u25B7'}</span>{n}
              </button>
            );
          })}
        </div>
      </div>
      {/* Save button */}
      <div style={{ padding:'6px clamp(14px,3vw,40px)', flexShrink:0 }}>
        <button onClick={()=>setShowSave(!showSave)} style={{
          padding:'5px 12px', borderRadius:0, border:'1px solid rgba(255,255,255,0.18)',
          background:'#000', color:'#fff', fontSize:10, cursor:'pointer', fontFamily:IMP, letterSpacing:1,
          display:'flex', alignItems:'center', gap:4 }}>{'\uD83D\uDCBE'} SAVE</button>
        {showSave && (
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name"
              style={{ flex:1, padding:'5px 8px', border:'1px solid rgba(255,255,255,0.18)', borderRadius:0, fontSize:11, outline:'none' }} />
            <button onClick={()=>{if(!saveName.trim())return;
              setSaved(p=>[...p,{name:saveName,patterns:JSON.parse(JSON.stringify(patterns)),bpm,swing}]);
              setSaveName('');setShowSave(false);}} style={{
              padding:'5px 12px', borderRadius:0, border:'none', background:'rgba(255,255,255,0.14)', color:'#fff',
              fontSize:10, cursor:'pointer', fontFamily:IMP }}>OK</button>
          </div>
        )}
        {saved.map((s,i)=>(
          <button key={i} onClick={()=>{stop();const p={};TRACK_DEFS.forEach(t=>p[t.id]=s.patterns[t.id]?[...s.patterns[t.id]]:new Array(16).fill(false));
            setPatterns(p);setBpm(s.bpm);setSwing(s.swing);}} style={{
            display:'block', padding:'4px 8px', marginTop:4, borderRadius:0, border:'1px solid rgba(255,255,255,0.12)',
            background:'#000', color:'#fff', cursor:'pointer', fontSize:10, fontFamily:IMP }}>{'\uD83D\uDCC1'} {s.name}</button>
        ))}
      </div>
      {/* Beat numbers */}
      <div style={{ padding:'4px clamp(14px,3vw,40px) 2px', display:'flex', flexShrink:0, gap:6 }}>
        <div style={{ width:106, flexShrink:0 }} />
        <div style={{ flex:1, display:'flex', gap:3 }}>
          {Array.from({length:16},(_,i)=>(
            <div key={i} style={{ flex:1, textAlign:'center', fontFamily:IMP, fontSize:10,
              color:i%4===0?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.22)', letterSpacing:1 }}>{i%4===0?(i/4)+1:'\u00B7'}</div>
          ))}
        </div>
        <div style={{ width:150, flexShrink:0 }} />
      </div>
      {/* Step grid — one row per track, stretches to fill the page */}
      <div style={{ flex:1, overflow:'auto', padding:'2px clamp(14px,3vw,40px) 92px', display:'flex', flexDirection:'column', gap:6 }}>
        {TRACK_DEFS.map(track=>(
          <div key={track.id} style={{ display:'flex', alignItems:'stretch', gap:6, flex:'1 1 0', minHeight:42 }}>
            {/* Label */}
            <div style={{ width:106, flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'0 4px',
              borderLeft:`4px solid ${track.color}`, borderRadius:0, background:'rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize:16 }}>{track.emoji}</span>
              <span style={{ fontFamily:IMP, fontSize:11, letterSpacing:1, lineHeight:1.05 }}>{track.name}</span>
            </div>
            {/* 16 step buttons */}
            <div style={{ flex:1, display:'flex', gap:3, alignItems:'stretch' }}>
              {(patterns[track.id]||[]).map((on,i)=>(
                <button key={i} onClick={()=>setPatterns(p=>({...p,[track.id]:p[track.id].map((v,j)=>j===i?!v:v)}))} style={{
                  flex:1, minWidth:0, minHeight:34, borderRadius:0, border:'none', cursor:'pointer', transition:'all 0.08s',
                  background: currentStep===i&&playing ? (on?'#fff':'rgba(255,255,255,0.9)') : on?track.color:(i%4===0?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)'),
                  boxShadow: on ? `0 2px 8px ${track.color}55` : 'none',
                  outline: currentStep===i&&playing ? `2px solid ${track.color}` : 'none',
                  opacity: muted[track.id]?0.35:1,
                }} />
              ))}
            </div>
            {/* Controls: vol + M + S + dice + × */}
            <div style={{ width:150, flexShrink:0, display:'flex', alignItems:'center', gap:4 }}>
              <input type="range" min="0" max="100" value={Math.round((volumes[track.id]??track.vol)*100)}
                onChange={e=>setVolumes(p=>({...p,[track.id]:e.target.value/100}))} style={{ width:52, flexShrink:0 }} />
              <button onClick={()=>setMuted(p=>({...p,[track.id]:!p[track.id]}))} style={{
                width:30, height:30, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', fontSize:11, cursor:'pointer',
                fontFamily:IMP, background:muted[track.id]?'#c00':'#fff', color:muted[track.id]?'#fff':'rgba(0,0,0,0.4)' }}>M</button>
              <button onClick={()=>setSolo(p=>p===track.id?null:track.id)} style={{
                width:30, height:30, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', fontSize:11, cursor:'pointer',
                fontFamily:IMP, background:solo===track.id?'#f90':'#fff', color:solo===track.id?'#fff':'rgba(0,0,0,0.4)' }}>S</button>
              <button onClick={()=>setPatterns(p=>({...p,[track.id]:p[track.id].map(()=>Math.random()>0.65)}))}
                style={{ width:30, height:30, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', fontSize:13, cursor:'pointer', background:'#000' }}>{'\uD83C\uDFB2'}</button>
              <button onClick={()=>setPatterns(p=>({...p,[track.id]:new Array(16).fill(false)}))}
                style={{ width:30, height:30, borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', fontSize:12, cursor:'pointer', background:'#000', color:'#fff' }}>{'\u2715'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ProfilePage ── */
function ProfilePage({ setPage }) {
  const [avatar,setAvatar]=useState(null);
  const [username,setUsername]=useState('your_tag');
  const [editingName,setEditingName]=useState(false);
  const [uploads,setUploads]=useState([]);
  const [archived,setArchived]=useState([]);
  const [collection,setCollection]=useState([]);
  const [tab,setTab]=useState('uploads');
  const [showModal,setShowModal]=useState(false);
  const avatarRef=useRef(null);
  const totalLikes=uploads.reduce((s,p)=>s+(p.likes||0),0);
  const score=uploads.length*50+totalLikes*10+archived.length*5+collection.length*20;
  const rank=score>=5000?'Gold':score>=1000?'Silver':'Bronze';
  const rankEmoji=rank==='Gold'?'\uD83E\uDD47':rank==='Silver'?'\uD83E\uDD48':'\uD83E\uDD49';
  const target=rank==='Gold'?10000:rank==='Silver'?5000:1000;
  const progress=Math.min(100,Math.round(score/target*100));
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#000' }}>
      <PageHeader setPage={setPage} subtitle="MEMBER PROFILE" />
      <div style={{ flex:1, overflow:'auto', padding:'16px clamp(14px,3vw,40px) 100px' }}>
        {/* Profile card */}
        <div style={{ border:'1px solid rgba(255,255,255,0.12)', borderRadius:0, padding:'20px 16px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:14 }}>
          <div style={{ position:'relative' }}>
            <div onClick={()=>avatarRef.current?.click()} style={{
              width:80, height:80, borderRadius:0, background:'rgba(255,255,255,0.06)', overflow:'hidden',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px dashed rgba(255,255,255,0.25)',
            }}>
              {avatar ? <img src={avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:32, color:'#fff' }}>{'\uD83D\uDC64'}</span>}
            </div>
            <div onClick={()=>avatarRef.current?.click()} style={{
              position:'absolute', bottom:-2, right:-2, width:24, height:24, borderRadius:0,
              background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, cursor:'pointer', border:'2px solid #fff' }}>+</div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files[0];if(f)setAvatar(URL.createObjectURL(f))}} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {editingName?(
                <div style={{ display:'flex', gap:4 }}>
                  <input value={username} onChange={e=>setUsername(e.target.value)}
                    style={{ padding:'3px 6px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:0, fontSize:13, fontFamily:IMP, width:100 }} />
                  <button onClick={()=>setEditingName(false)} style={{ padding:'3px 8px', borderRadius:0, border:'none', background:'#fff', color:'#000', fontSize:9, cursor:'pointer', fontFamily:IMP }}>SAVE</button>
                </div>
              ):(
                <>
                  <span style={{ fontFamily:IMP, fontSize:16, fontWeight:700 }}>@{username}</span>
                  <button onClick={()=>setEditingName(true)} style={{ padding:'3px 10px', borderRadius:0,
                    border:'1px solid rgba(255,255,255,0.18)', background:'#000', color:'#fff', fontSize:9, cursor:'pointer', fontFamily:IMP, letterSpacing:1 }}>EDIT</button>
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {[{l:'Posts',v:uploads.length},{l:'Archived',v:archived.length},{l:'Saved',v:collection.length},{l:'Likes',v:totalLikes}].map(s=>(
                <span key={s.l} style={{ padding:'4px 10px', borderRadius:0, background:'rgba(255,255,255,0.06)', fontSize:10, fontFamily:IMP, letterSpacing:1 }}>
                  {s.v} {s.l}
                </span>
              ))}
            </div>
          </div>
          {/* Score badge */}
          <div style={{ background:'#000', borderRadius:0, padding:'12px 14px', textAlign:'center', flexShrink:0, minWidth:72 }}>
            <div style={{ fontSize:18 }}>{rankEmoji}</div>
            <div style={{ fontFamily:IMP, fontSize:'clamp(16px,4vw,20px)', color:'#fff', lineHeight:1, marginTop:4 }}>{score.toLocaleString()}</div>
            <div style={{ fontSize:10, color:'#fff', letterSpacing:1, marginTop:3 }}>{rank.toUpperCase()}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <span style={{ fontSize:9, fontFamily:IMP, letterSpacing:2, color:'#fff' }}>PROGRESS TO NEXT RANK</span>
          <span style={{ fontSize:10, fontFamily:IMP, color:'#fff' }}>{score} / {target}</span>
        </div>
        <div style={{ height:4, background:'rgba(255,255,255,0.1)', borderRadius:0, marginBottom:18, overflow:'hidden' }}>
          <div style={{ height:'100%', background:'#fff', borderRadius:0, width:`${progress}%`, transition:'width 0.3s' }} />
        </div>
        {/* Tabs + upload */}
        <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.1)', marginBottom:16 }}>
          {['uploads','archive','collection'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'10px 16px', border:'none', background:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:2, textTransform:'uppercase',
              borderBottom:tab===t?'2px solid #fff':'2px solid transparent',
              color:tab===t?'#fff':'rgba(255,255,255,0.4)' }}>{t}</button>
          ))}
          <button onClick={()=>setShowModal(true)} style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:0,
            border:'none', background:'#fff', color:'#000', fontFamily:IMP, fontSize:10, letterSpacing:1, cursor:'pointer' }}>+ UPLOAD</button>
        </div>
        {/* Tab content */}
        {tab==='uploads'&&(
          uploads.length===0?(
            <div style={{ textAlign:'center', padding:'50px 0', color:'#fff' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCF7'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>NO UPLOADS YET</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {uploads.map(p=>(
                <div key={p.id} style={{ aspectRatio:'1', borderRadius:0, overflow:'hidden', position:'relative' }}>
                  {p.type==='video'?<video src={p.src} muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    :<img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex' }}>
                    <button onClick={()=>setCollection(prev=>[...prev,p])} style={{ flex:1, padding:'4px', border:'none', background:'rgba(255,255,255,0.85)', fontSize:9, cursor:'pointer' }}>{'\uD83D\uDCBE'}</button>
                    <button onClick={()=>setArchived(prev=>[...prev,{...p,archivedAt:new Date().toLocaleDateString()}])} style={{ flex:1, padding:'4px', border:'none', background:'rgba(255,255,255,0.85)', fontSize:9, cursor:'pointer' }}>{'\uD83D\uDCC1'}</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {tab==='archive'&&(
          archived.length===0?(
            <div style={{ textAlign:'center', padding:'50px 0', color:'#fff' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCC1'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>ARCHIVE EMPTY</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {archived.map((p,i)=>(
                <div key={i} style={{ aspectRatio:'1', borderRadius:0, overflow:'hidden', position:'relative' }}>
                  <img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <span style={{ position:'absolute', bottom:3, left:3, fontSize:7, background:'rgba(0,0,0,0.6)', color:'#fff', padding:'2px 5px', borderRadius:0 }}>{p.archivedAt}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab==='collection'&&(
          collection.length===0?(
            <div style={{ textAlign:'center', padding:'50px 0', color:'#fff' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCBE'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>NOTHING SAVED YET</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {collection.map((p,i)=>(
                <div key={i} style={{ aspectRatio:'1', borderRadius:0, overflow:'hidden' }}>
                  <img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {showModal && <UploadModal onClose={()=>setShowModal(false)} onUpload={photo=>setUploads(p=>[photo,...p])} />}
    </div>
  );
}

/* ══════════════════════════ NAVBAR ══════════════════════════ */
function NavBar({ page, setPage }) {
  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:200,
      display:'flex', alignItems:'flex-start',
      paddingTop:10,
      paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)',
      paddingBottom:'max(14px, env(safe-area-inset-bottom, 14px))',
      background:'#000', borderTop:'0.5px solid rgba(255,255,255,0.1)',
    }}>
      {NAV_ITEMS.map(item=>{
        const active=page===item.key;
        return (
          <button key={item.key} onClick={()=>setPage(item.key)} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            gap:3, padding:'0 2px', border:'none', background:'none', cursor:'pointer',
            transition:'opacity 0.15s',
          }}>
            {/* Pill wraps icon only — fixed 36×26 so active highlight is always the same size */}
            <span style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:36, height:26, borderRadius:0,
              background:active?'rgba(255,255,255,0.14)':'transparent',
              transition:'background 0.18s',
              fontSize:16, lineHeight:1,
            }}>{item.icon}</span>
            <span style={{
              fontFamily:IMP, fontSize:9, letterSpacing:'0.04em',
              color:active?'#fff':'rgba(255,255,255,0.5)',
              transition:'color 0.18s', whiteSpace:'nowrap',
            }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════ ROOT APP ══════════════════════════ */
/* ── VIPModal — waiting list form (name/email/phone/social/bio) ── */
function VIPModal({ onClose, onJoin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [social, setSocial] = useState('');
  const [bio, setBio] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const error = !!errMsg;
  const submit = async () => {
    if (submitting) return;
    if (!valid) { setErrMsg('Enter a valid email to join.'); return; }
    setSubmitting(true);
    setErrMsg('');
    const payload = { name, email, phone, social, bio, ref: referredBy() };
    try {
      const res = await fetch('/api/vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      // Keep a local backup so the signup is never lost, but tell the user if the server failed.
      try {
        const list = JSON.parse(localStorage.getItem('autograff_vip_signups') || '[]');
        list.push({ ...payload, ts: Date.now(), synced: false });
        localStorage.setItem('autograff_vip_signups', JSON.stringify(list));
      } catch (_) {}
      setSubmitting(false);
      setErrMsg(err.message || 'Network error. Please try again.');
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
    onJoin();
    // Vercel Web Analytics custom event (no-op until Web Analytics is enabled on the project).
    try { if (typeof window !== 'undefined' && typeof window.va === 'function') window.va('event', { name: 'VIP Signup' }); } catch (_) {}
    setTimeout(onClose, 3200);
  };
  const field = { width:'100%', padding:'12px 14px', borderRadius:0, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, fontFamily:'Georgia,serif', outline:'none', marginBottom:10 };
  const lbl = { display:'block', textAlign:'left', fontFamily:IMP, fontSize:9, letterSpacing:2, color:'#fff', marginBottom:5 };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:800, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#000', color:'#fff', borderRadius:0, width:440, maxWidth:'94vw', maxHeight:'92vh', overflowY:'auto', padding:'32px 30px 26px', position:'relative', boxShadow:'0 24px 80px rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onClose} aria-label="Close" style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', lineHeight:1, zIndex:2 }}>{'\u2715'}</button>
        {!submitted ? (
          <>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:IMP, fontSize:11, letterSpacing:5, color:'#fff', opacity:0.5, marginBottom:12 }}>WAITING LIST</div>
              <div style={{ fontFamily:IMP, fontSize:'clamp(23px,6vw,29px)', letterSpacing:1, lineHeight:1.08, marginBottom:12 }}>BE FIRST ON<br/>THE APP STORE</div>
              <div style={{ fontSize:13, lineHeight:1.55, color:'#fff', marginBottom:22, maxWidth:340, marginLeft:'auto', marginRight:'auto' }}>
                Complete your profile to join the waiting list. You{'\u2019'}ll get in first {'\u2014'} we{'\u2019'}ll notify you the moment AUTOGRAFF hits the App Store, plus the drop date and first look at the designs.
              </div>
            </div>
            <label style={lbl}>NAME</label>
            <input value={name} onChange={e=>setName(e.target.value)} type="text" placeholder="Full name" autoFocus style={field} />
            <label style={lbl}>EMAIL <span style={{ color:'#e53935' }}>*</span></label>
            <input value={email} onChange={e=>{setEmail(e.target.value); setErrMsg('');}} type="email" placeholder="you@email.com"
              style={{ ...field, border: error?'1px solid #e53935':field.border, marginBottom: error?4:10 }} />
            {error && <div style={{ color:'#e53935', fontSize:11, marginBottom:8, textAlign:'left' }}>{errMsg}</div>}
            <label style={lbl}>PHONE</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="Phone number" style={field} />
            <label style={lbl}>SOCIAL MEDIA</label>
            <input value={social} onChange={e=>setSocial(e.target.value)} type="text" placeholder="@handle (Instagram, TikTok, X)" style={field} />
            <label style={lbl}>BIO</label>
            <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell us about you and your work..." rows={3}
              style={{ ...field, resize:'vertical', minHeight:72 }} />
            <button onClick={submit} disabled={submitting} style={{ width:'100%', marginTop:6, padding:'15px', border:'none', borderRadius:0, background: submitting?'rgba(255,255,255,0.5)':'#fff', color:'#000', fontFamily:IMP, fontSize:15, letterSpacing:3, cursor: submitting?'default':'pointer', transition:'transform 0.15s' }}
              onMouseEnter={e=>{ if(!submitting) e.currentTarget.style.transform='scale(1.02)'; }} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              {submitting ? 'JOINING\u2026' : <>JOIN THE WAITING LIST {'\u2192'}</>}
            </button>
            <div style={{ marginTop:16, textAlign:'center', fontSize:10.5, color:'#fff', letterSpacing:1 }}>
              No spam, ever
            </div>
          </>
        ) : (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <div style={{ fontSize:42, marginBottom:14, color:'#3ad07a' }}>{'\u2713'}</div>
            <div style={{ fontFamily:IMP, fontSize:24, letterSpacing:1, marginBottom:10 }}>YOU{'\u2019'}RE ON THE WAITING LIST</div>
            <div style={{ fontSize:13, lineHeight:1.55, color:'#fff', maxWidth:300, margin:'0 auto' }}>
              {name ? name.split(' ')[0] + ', you' : 'You'}{'\u2019'}re in. We{'\u2019'}ll email you the second AUTOGRAFF hits the App Store {'\u2014'} plus the drop date and first look at the designs. No spam, ever.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Onboarding — creator (apply) / member (log in) / dev-bypass ── */
const OB_WRAP = { width:'100%', height:'100%', background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'clamp(20px,6vw,60px)', textAlign:'center', overflowY:'auto' };
const OB_FIELD = { width:'100%', padding:'13px 14px', borderRadius:0, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, outline:'none', fontFamily:HELV, marginBottom:10, boxSizing:'border-box' };
const OB_LABEL = { fontFamily:HELV, fontSize:9, letterSpacing:3, color:'#8f8f8f', textTransform:'uppercase', textAlign:'left', marginBottom:6, marginTop:4 };
const OB_PRIMARY = { width:'100%', marginTop:8, background:'#fff', color:'#000', border:'none', borderRadius:0, padding:'14px', fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:'pointer' };
function OnboardBack({ onBack }) {
  return <button onClick={onBack} style={{ marginTop:18, background:'none', border:'none', color:'rgba(255,255,255,0.45)', fontFamily:HELV, fontSize:11, letterSpacing:2, cursor:'pointer', textTransform:'uppercase' }}>← Back</button>;
}

/* Creator application — reviewed by hand; lands in the same waitlist ledger, tagged. */
function CreatorApply({ enter, onBack }) {
  const [f, setF] = useState({ name:'', email:'', social:'', medium:'', link:'' });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return;
    try {
      fetch('/api/vip', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:f.name, email:f.email, social:f.social, bio:'CREATOR APPLICATION — medium: ' + f.medium + ' — portfolio: ' + f.link, role:'creator' }) });
    } catch (_) {}
    setSent(true);
  };
  if (sent) return (
    <div style={OB_WRAP}>
      <div style={{ fontFamily:IMP, fontSize:'clamp(26px,6vw,40px)', color:'#fff', letterSpacing:0.5 }}>Application received.</div>
      <div style={{ fontFamily:HELV, fontSize:13, color:'#9a9a9a', marginTop:12, maxWidth:380, lineHeight:1.6 }}>We review every submission by hand. If your work fits, you’ll hear from us.</div>
      <button onClick={() => enter('creator')} style={{ ...OB_PRIMARY, maxWidth:320, marginTop:24 }}>ENTER THE GALLERY</button>
    </div>
  );
  return (
    <div style={OB_WRAP}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ fontFamily:HELV, fontSize:11, letterSpacing:5, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:8, textAlign:'left' }}>Creator</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(24px,6vw,36px)', color:'#fff', letterSpacing:0.5, marginBottom:20, textAlign:'left' }}>Show us your work</div>
        <div style={OB_LABEL}>Name</div><input style={OB_FIELD} value={f.name} onChange={set('name')} placeholder="Your name" />
        <div style={OB_LABEL}>Email</div><input style={OB_FIELD} value={f.email} onChange={set('email')} placeholder="you@email.com" />
        <div style={OB_LABEL}>Social / handle</div><input style={OB_FIELD} value={f.social} onChange={set('social')} placeholder="@handle" />
        <div style={OB_LABEL}>Medium</div><input style={OB_FIELD} value={f.medium} onChange={set('medium')} placeholder="Graffiti, murals, photography…" />
        <div style={OB_LABEL}>Portfolio link</div><input style={OB_FIELD} value={f.link} onChange={set('link')} placeholder="https://" />
        <button onClick={submit} style={OB_PRIMARY}>SUBMIT APPLICATION</button>
        <OnboardBack onBack={onBack} />
      </div>
    </div>
  );
}

/* Member login — sign in to collect + support. Stub entry until the auth backend is wired. */
function MemberLogin({ enter, onBack }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div style={OB_WRAP}>
      <div style={{ width:'100%', maxWidth:360 }}>
        <div style={{ fontFamily:HELV, fontSize:11, letterSpacing:5, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:8, textAlign:'left' }}>Member</div>
        <div style={{ fontFamily:IMP, fontSize:'clamp(24px,6vw,36px)', color:'#fff', letterSpacing:0.5, marginBottom:20, textAlign:'left' }}>Log in</div>
        <input style={OB_FIELD} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="username" />
        <input style={OB_FIELD} value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" />
        <button onClick={() => { if (email.includes('@')) enter('member'); }} style={OB_PRIMARY}>LOG IN</button>
        <OnboardBack onBack={onBack} />
      </div>
    </div>
  );
}

/* ── OnboardPage — pick your lane, or dev-bypass into the platform ── */
function OnboardPage({ setPage }) {
  const [mode, setMode] = useState('choose');
  const enter = (role) => { try { localStorage.setItem('autograff_role', role); } catch (_) {} setPage('guest'); };
  if (mode === 'creator') return <CreatorApply enter={enter} onBack={() => setMode('choose')} />;
  if (mode === 'member')  return <MemberLogin enter={enter} onBack={() => setMode('choose')} />;
  const opts = [
    { k:'creator', t:'CREATOR', d:'Show your work' },
    { k:'member',  t:'MEMBER',  d:'Log in + collect' },
  ];
  return (
    <div style={OB_WRAP}>
      <div style={{ fontFamily:HELV, fontSize:11, letterSpacing:5, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:14 }}>Set up your dashboard</div>
      <div style={{ fontFamily:IMP, fontSize:'clamp(28px,7vw,48px)', color:'#fff', letterSpacing:0.5, lineHeight:1, marginBottom:'clamp(28px,5vh,44px)', maxWidth:560 }}>How do you want to enter?</div>
      <div style={{ display:'flex', gap:'clamp(12px,3vw,20px)', flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:560 }}>
        {opts.map(o => (
          <button key={o.k} onClick={() => setMode(o.k)} style={{
            flex:'1 1 200px', minWidth:170, background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.3)',
            borderRadius:0, padding:'clamp(24px,5vw,40px) 20px', cursor:'pointer', transition:'all .25s', WebkitTapHighlightColor:'transparent',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#000'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#fff'; }}
          >
            <div style={{ fontFamily:IMP, fontSize:'clamp(20px,4vw,26px)', letterSpacing:2 }}>{o.t}</div>
            <div style={{ fontFamily:HELV, fontSize:11, letterSpacing:1, marginTop:8, opacity:0.7 }}>{o.d}</div>
          </button>
        ))}
      </div>
      <button onClick={() => enter('dev')} style={{
        marginTop:'clamp(28px,5vh,44px)', background:'none', border:'none', color:'rgba(255,255,255,0.45)',
        fontFamily:HELV, fontSize:11, letterSpacing:2, cursor:'pointer', textTransform:'uppercase', WebkitTapHighlightColor:'transparent',
      }}>Skip — dev bypass →</button>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('splash');
  const [showVIP, setShowVIP] = useState(false);
  const joinedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    captureRef();
    pingSeen(); // register presence so lurkers surface on the ledger at zero
    if (localStorage.getItem('autograff_vip') || localStorage.getItem('autograff_vip_dismissed')) return;
    const timer = setTimeout(() => setShowVIP(true), 3000);
    const onExit = (e) => { if (e.clientY <= 0) setShowVIP(true); };
    document.addEventListener('mouseleave', onExit);
    return () => { clearTimeout(timer); document.removeEventListener('mouseleave', onExit); };
  }, []);
  useEffect(() => {
    // Manual opens (WAITING LIST button) always work, even after dismiss/join.
    const manual = () => setShowVIP(true);
    window.addEventListener('open-vip', manual);
    return () => window.removeEventListener('open-vip', manual);
  }, []);
  const closeVIP = () => {
    setShowVIP(false);
    if (!joinedRef.current && typeof window !== 'undefined') localStorage.setItem('autograff_vip_dismissed', '1');
  };
  const joinVIP = () => {
    joinedRef.current = true;
    try { localStorage.setItem('autograff_vip', '1'); window.dispatchEvent(new Event('vip-joined')); } catch (_) {}
  };
  // 100% (not 100vh) because html/body/#root above are already height:100% and resolve
  // to the truly visible area — 100vh would overshoot by the height of iOS Safari's URL
  // bar, and #root's overflow:hidden would clip the difference away unreachably.
  return (
    <div style={{ width:'100%', height:'100%', background:'#000', overflow:'hidden', position:'relative', color:'#fff', paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)' }}>
      {page==='splash'      && <SplashPage setPage={setPage} />}
      {page==='onboard'      && <OnboardPage setPage={setPage} />}
      {page==='guest'        && <GuestPage setPage={setPage} />}
      {page==='photos'       && <PhotosPage setPage={setPage} />}
      {page==='leaderboard'  && <LeaderboardPage setPage={setPage} />}
      {page==='members'      && <MembersPage setPage={setPage} />}
      {page==='studio'       && <StudioPage setPage={setPage} />}
      {page==='profile'      && <ProfilePage setPage={setPage} />}
      {page!=='splash' && page!=='onboard' && <NavBar page={page} setPage={setPage} />}
      {showVIP && <VIPModal onClose={closeVIP} onJoin={joinVIP} />}
    </div>
  );
}
