import React, { useState, useRef, useEffect, useCallback } from 'react';
import { upload } from '@vercel/blob/client';

/* ══════════════════════════ GLOBAL STYLES ══════════════════════════ */
if (typeof document !== 'undefined') {
  const _s = document.createElement('style');
  _s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { display: none; }
    html, body, #root { height:100%; overflow:hidden; }
    body { font-family: Georgia, serif; background: #fff; }
    @media (min-width:769px) {
      body { background: #f5f5f5; }
    }
    @keyframes floatHeart {
      0%   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
      60%  { opacity:0.9; }
      100% { opacity:0; transform:translateX(-50%) translateY(-88px) scale(1.6); }
    }
    @keyframes marqueeText {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    input[type="range"] {
      -webkit-appearance: none; height:4px; background:rgba(0,0,0,0.15); border-radius:2px; outline:none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance:none; width:16px; height:16px; background:#fff; border:2px solid #000;
      border-radius:50%; cursor:pointer;
    }
  `;
  document.head.appendChild(_s);
}

/* ══════════════════════════ CONSTANTS ══════════════════════════ */
const HEART_EMOJIS = ['\u2764\uFE0F','\uD83E\uDDE1','\uD83D\uDC9B','\uD83D\uDC9A','\uD83D\uDC99','\uD83D\uDC9C','\uD83D\uDDA4','\uD83D\uDC96','\uD83D\uDC9D'];

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

const LOGO_URI = '/logo-icon.png';

const SEED_PHOTOS = [
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
];

const MOCK_MEMBERS = [
  { id:1, handle:'aurora_lens', name:'Aurora Lane', bio:'Capturing light & shadow. Miami based photographer.', score:8420, rank:'Gold', followers:1200, following:180, posts:SEED_PHOTOS.slice(0,4) },
  { id:2, handle:'pixel_nomad', name:'Alex Nomad', bio:'Street art & travel. Always moving, always shooting.', score:5100, rank:'Gold', followers:890, following:220, posts:SEED_PHOTOS.slice(2,6) },
  { id:3, handle:'shuttercraft', name:'Sam Craft', bio:'Urban geometry. Architecture through my lens.', score:3200, rank:'Silver', followers:670, following:340, posts:SEED_PHOTOS.slice(4,8) },
  { id:4, handle:'frame_wolf', name:'Felix Wolf', bio:'Nature & wildlife. Film + digital hybrid.', score:1800, rank:'Silver', followers:430, following:190, posts:SEED_PHOTOS.slice(6,10) },
  { id:5, handle:'lenscraft99', name:'Lena Cruz', bio:'Murals & public art across the Americas.', score:980, rank:'Bronze', followers:310, following:280, posts:SEED_PHOTOS.slice(8,12) },
  { id:6, handle:'voidshooter', name:'Victor Odin', bio:'Minimalist compositions in urban spaces.', score:540, rank:'Bronze', followers:210, following:150, posts:SEED_PHOTOS.slice(10,13) },
  { id:7, handle:'chromatic_eye', name:'Chroma Blake', bio:'Color theory in the wild.', score:310, rank:'Bronze', followers:125, following:90, posts:SEED_PHOTOS.slice(0,3) },
  { id:8, handle:'stellarframe', name:'Stella Ray', bio:'Astrophotography meets street.', score:180, rank:'Bronze', followers:88, following:45, posts:SEED_PHOTOS.slice(5,8) },
];

const NAV_ITEMS = [
  { key:'guest',       label:'EXPLORE',  icon:'\uD83D\uDD0D' },
  { key:'photos',      label:'PHOTOS',   icon:'\uD83D\uDDBC' },
  { key:'leaderboard', label:'BOARD',    icon:'\uD83C\uDFC6' },
  { key:'members',     label:'MEMBERS',  icon:'\uD83D\uDC65' },
  { key:'studio',      label:'STUDIO',   icon:'\uD83C\uDFB5' },
  { key:'profile',     label:'YOU',      icon:'\uD83D\uDC64' },
];

const TRACK_DEFS = [
  { id:1, name:'KICK',   emoji:'\uD83E\uDD41', color:'#000', freq:80,  type:'sine',     attack:0.001, decay:0.18, vol:0.9  },
  { id:2, name:'SNARE',  emoji:'\uD83D\uDD34', color:'#c00', freq:200, type:'noise',    attack:0.001, decay:0.12, vol:0.7  },
  { id:3, name:'HI-HAT', emoji:'\u26A1',        color:'#555', freq:800, type:'noise',    attack:0.001, decay:0.04, vol:0.5  },
  { id:4, name:'BASS',   emoji:'\uD83C\uDFB8', color:'#333', freq:55,  type:'sawtooth', attack:0.01,  decay:0.35, vol:0.8  },
  { id:5, name:'SYNTH',  emoji:'\uD83C\uDFB9', color:'#444', freq:440, type:'square',   attack:0.02,  decay:0.28, vol:0.6  },
  { id:6, name:'PERC',   emoji:'\uD83E\uDD41', color:'#666', freq:180, type:'triangle', attack:0.001, decay:0.22, vol:0.65 },
];

const PRESETS = {
  'HOUSE BEAT': { bpm:124, swing:0, patterns:{ 1:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], 4:[1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0], 5:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 6:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }},
  'HIP HOP': { bpm:90, swing:45, patterns:{ 1:[1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1], 3:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0], 4:[1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0], 5:[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0], 6:[0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0] }},
  'TRAP': { bpm:140, swing:20, patterns:{ 1:[1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], 2:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], 4:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 5:[0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0], 6:[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1] }},
};

/* ══════════════════════════ AUDIO ENGINE ══════════════════════════ */
function playSound(ctx, track, time, vol) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vol * track.vol, time + track.attack);
  g.gain.exponentialRampToValueAtTime(0.001, time + track.attack + track.decay);
  if (track.type === 'noise') {
    const len = ctx.sampleRate * (track.decay + track.attack);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = track.freq > 500 ? 'highpass' : 'bandpass';
    filt.frequency.value = track.freq > 500 ? 6000 : track.freq;
    if (track.freq <= 500) filt.Q.value = 1;
    src.connect(filt); filt.connect(g); src.start(time); src.stop(time + track.attack + track.decay);
  } else {
    const osc = ctx.createOscillator(); osc.type = track.type;
    osc.frequency.setValueAtTime(track.freq, time);
    if (track.name === 'KICK') osc.frequency.exponentialRampToValueAtTime(30, time + track.decay);
    osc.connect(g); osc.start(time); osc.stop(time + track.attack + track.decay + 0.01);
  }
}

/* ══════════════════════════ HOOKS ══════════════════════════ */
function useFloatingHearts() {
  const [bursts, setBursts] = useState([]);
  const spawn = useCallback((x, y) => {
    const h = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i + Math.random(), x: x + (Math.random() - 0.5) * 44, y: y - 10,
      size: 13 + Math.random() * 14, dur: 1.1 + Math.random() * 0.9,
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
    }));
    setBursts(prev => [...prev, ...h]);
    setTimeout(() => setBursts(prev => prev.filter(b => !h.includes(b))), 2600);
  }, []);
  return { bursts, spawn };
}

/* ══════════════════════════ SMALL COMPONENTS ══════════════════════════ */
const IMP = "Impact,'Arial Narrow',sans-serif";

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
function sendLike(id) {
  try {
    fetch('/api/likes', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, uid: myRef(), name: myHandle() }) });
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

/* Floating "JOIN VIP" pill shown above the NavBar on every non-splash page. */
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
      borderRadius:24, padding:'11px 18px', cursor:'pointer',
      fontFamily:IMP, fontSize:12, letterSpacing:2,
      boxShadow:'0 6px 22px rgba(0,0,0,0.28)', WebkitTapHighlightColor:'transparent',
    }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}
    >
      <span style={{ fontSize:13 }}>{joined ? '\u2713' : '\u2605'}</span>
      {joined ? 'VIP LIST' : 'JOIN VIP'}
    </button>
  );
}

/* App Store "coming soon" band — launch framing + VIP CTA. */
function AppStoreBanner({ style }) {
  return (
    <div style={{ background:'#000', color:'#fff', borderRadius:14, padding:'24px 22px', textAlign:'center',
      backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 12px)',
      border:'1px solid rgba(255,255,255,0.08)', ...style }}>
      <div style={{ fontSize:26, marginBottom:8 }}>{'\uD83D\uDCF1'}</div>
      <div style={{ fontFamily:IMP, fontSize:10, letterSpacing:5, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>COMING SOON TO iOS</div>
      <div style={{ fontFamily:IMP, fontSize:'clamp(20px,5.5vw,26px)', letterSpacing:1, lineHeight:1.1, marginBottom:10 }}>THE APP DROPS<br/>ON THE APP STORE</div>
      <div style={{ fontSize:12.5, lineHeight:1.55, color:'rgba(255,255,255,0.62)', maxWidth:320, margin:'0 auto 18px' }}>
        AUTOGRAFF is launching on iPhone. Join the VIP list and we{'\u2019'}ll notify you the moment it{'\u2019'}s live {'\u2014'} plus the drop date and first look at the designs.
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={openVIP} style={{ padding:'12px 22px', border:'none', borderRadius:10, background:'#fff', color:'#000',
          fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:'pointer' }}>{'\u2605'} JOIN THE VIP LIST</button>
        <button onClick={()=>shareAutograff()} style={{ padding:'12px 20px', borderRadius:10, background:'transparent', color:'#fff',
          border:'1px solid rgba(255,255,255,0.25)', fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:'pointer' }}>{'\u2197'} SHARE</button>
      </div>
      <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:8,
        border:'1px solid rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize:16 }}>{'\uF8FF'}</span>
        <div style={{ textAlign:'left', lineHeight:1.1 }}>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:1 }}>Coming soon on the</div>
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
        <span key={h.id} style={{ position:'absolute', left:h.x, top:h.y, fontSize:h.size,
          animation:`floatHeart ${h.dur}s ease-out forwards`, pointerEvents:'none' }}>{h.emoji}</span>
      ))}
    </div>
  );
}

function LogoButton({ setPage }) {
  return (
    <img src={LOGO_URI} alt="logo" onClick={() => setPage('splash')}
      style={{ width:'clamp(40px,5vw,64px)', height:'clamp(40px,5vw,64px)', objectFit:'contain', flexShrink:0, cursor:'pointer', transition:'transform 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform='scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform='scale(1)'} />
  );
}

function PageHeader({ setPage, subtitle, right }) {
  return (
    <div style={{ padding:'clamp(10px,1.5vh,18px) clamp(14px,3vw,40px) clamp(8px,1vh,14px)', borderBottom:'1px solid rgba(0,0,0,0.07)',
      display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'clamp(6px,1vw,12px)' }}>
        <LogoButton setPage={setPage} />
        <div>
          <div style={{ fontFamily:IMP, fontSize:'clamp(18px,2.5vw,32px)', color:'#000', letterSpacing:'-.5px', lineHeight:1, fontWeight:900 }}>AUTOGRAFF</div>
          <div style={{ fontSize:'clamp(10px,1vw,12px)', color:'rgba(0,0,0,0.35)', letterSpacing:3, textTransform:'uppercase', marginTop:2 }}>{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

/* Instagram-style heart: outline until liked, then filled red. */
function HeartIcon({ filled, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display:'block', filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.55))', transition:'transform 0.2s' }}
      fill={filled ? '#e53935' : 'none'} stroke={filled ? '#e53935' : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

  const handleLike = (e) => {
    e.stopPropagation();
    setPop(true); setTimeout(() => setPop(false), 220);
    if (liked) return; // one like per photo, Instagram-style
    setLiked(true); markLiked(photo.id);
    const rect = e.currentTarget.closest('[data-card]').getBoundingClientRect();
    onLike(photo.id);
    if (onHeartSpawn) onHeartSpawn(e.clientX - rect.left, e.clientY - rect.top);
  };
  const handleShare = (e) => {
    e.stopPropagation();
    shareAutograff(`Check out "${photo.title}" on AUTOGRAFF — Share to Win.`);
  };

  return (
    <div data-card style={{
      width:'clamp(300px,72vw,760px)', aspectRatio:'3 / 2', borderRadius:4, position:'relative', overflow:'hidden',
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
          position:'absolute', top:12, right:12, width:26, height:26, borderRadius:'50%',
          border:'none', background:'rgba(0,0,0,0.4)', color:'#fff', fontSize:13,
          cursor:'pointer', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
        }}>{'\u2715'}</button>
      )}

      {/* Title + author */}
      <div style={{ position:'absolute', bottom:16, left:18, right:70, zIndex:60 }}>
        <div style={{ fontFamily:IMP, fontSize:'clamp(16px,2.4vw,22px)', color:'#fff', fontWeight:700, textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>{photo.title}</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', letterSpacing:0.5 }}>@{photo.user}</div>
      </div>

      {/* Subtle like + share overlays */}
      <div style={{ position:'absolute', bottom:16, right:16, display:'flex', flexDirection:'column', alignItems:'center', gap:14, zIndex:60 }}>
        <button onClick={handleLike} title={liked ? 'Liked' : 'Like'} style={{
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
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, width:360, maxWidth:'92vw', padding:22, position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ fontFamily:IMP, fontSize:15, letterSpacing:2 }}>ADD PHOTO / VIDEO</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>{'\u2715'}</button>
        </div>
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>inputRef.current?.click()}
          style={{ height:180, borderRadius:12, cursor:'pointer', position:'relative', overflow:'hidden',
            border:drag?'2px solid #000':'2px dashed rgba(0,0,0,0.18)', background:drag?'rgba(0,0,0,0.02)':'transparent',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={e=>handleFile(e.target.files[0])} />
          {preview ? (
            <>{file?.type.startsWith('video')
              ? <video src={preview} autoPlay muted loop playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#111' }} />
              : <img src={preview} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', background:'#111' }} />}
              <span style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:9, padding:'3px 8px', borderRadius:4, letterSpacing:1, fontFamily:IMP }}>TAP TO CHANGE</span>
            </>
          ) : (
            <div style={{ textAlign:'center', color:'rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize:28 }}>{'\uD83D\uDCF7'}</div>
              <div style={{ fontSize:11, marginTop:6 }}>Tap to browse or drag & drop</div>
            </div>
          )}
        </div>
        {file && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'7px 10px', background:'rgba(0,0,0,0.03)', borderRadius:8 }}>
            <span>{file.type.startsWith('video')?'\uD83C\uDFAC':'\uD83D\uDCF7'}</span>
            <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
            <span style={{ fontSize:10, color:'rgba(0,0,0,0.4)' }}>{(file.size/1024/1024).toFixed(1)} MB</span>
            <button onClick={()=>{setFile(null);setPreview(null)}} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13 }}>{'\u2715'}</button>
          </div>
        )}
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)"
          style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:12, marginTop:10, fontFamily:'Georgia,serif', outline:'none' }} />
        <button onClick={handleSubmit} disabled={!file||uploading} style={{
          width:'100%', padding:'11px', marginTop:10, border:'none', borderRadius:8,
          background:file&&!uploading?'#000':'rgba(0,0,0,0.1)', color:file&&!uploading?'#fff':'rgba(0,0,0,0.3)',
          fontFamily:IMP, fontSize:13, letterSpacing:2, cursor:file&&!uploading?'pointer':'default',
        }}>{done?'\u2713 POSTED!':uploading?'UPLOADING...':'POST'}</button>
        {uploadError && <div style={{ color:'#e53935', fontSize:11, marginTop:8, textAlign:'center' }}>{uploadError}</div>}
        {uploading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.92)', borderRadius:18, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontFamily:IMP, fontSize:15, letterSpacing:2, marginBottom:14 }}>{done?'\u2713 POSTED!':'UPLOADING...'}</div>
            <div style={{ width:'70%', height:4, background:'rgba(0,0,0,0.08)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#000', borderRadius:2, width:`${progress}%`, transition:'width 0.12s' }} />
            </div>
            <div style={{ marginTop:8, fontSize:11, color:'rgba(0,0,0,0.4)' }}>{Math.round(progress)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ScrollRow ── */
function ScrollRow({ photos, speed = 0.9, rowHeight: rh = 160, cardWidth: cw = 260, likeCounts = {} }) {
  const isWide = typeof window !== 'undefined' && window.innerWidth > 768;
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
          width:cardWidth, height:rowHeight, borderRadius:12, flexShrink:0,
          position:'relative', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.08)',
          transition:'transform 0.2s', cursor:'pointer',
        }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <img src={p.src} alt={p.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />
          <div style={{ position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:4, background:'#fff', borderRadius:20, padding:'3px 9px', boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>
            <span style={{ color:'#e53935', fontSize:12 }}>{'\u2764\uFE0F'}</span>
            <span style={{ fontFamily:IMP, fontSize:11, fontWeight:700 }}>{(likeCounts[p.id] ?? p.likes) >= 1000 ? ((likeCounts[p.id]??p.likes)/1000).toFixed(1)+'K' : (likeCounts[p.id]??p.likes)}</span>
          </div>
          <div style={{ position:'absolute', bottom:10, left:10 }}>
            <div style={{ fontFamily:IMP, fontSize:13, color:'#fff', fontWeight:700 }}>{p.title}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>@{p.user}</div>
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
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:18, width:420, maxWidth:'92vw', maxHeight:'88vh', overflow:'auto', position:'relative' }}>
        <div style={{ height:80, position:'relative', overflow:'hidden', borderRadius:'18px 18px 0 0', background:'#000' }}>
          {member.posts[0] && <img src={member.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'blur(8px)', opacity:0.4 }} />}
          <button onClick={onClose} style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>{'\u2715'}</button>
        </div>
        <div style={{ display:'flex', justifyContent:'center', marginTop:-32, position:'relative', zIndex:2 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', border:'3px solid #fff', overflow:'hidden', background:'#eee' }}>
            {member.posts[0] && <img src={member.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
          </div>
        </div>
        <div style={{ textAlign:'center', padding:'6px 18px 0' }}>
          <div style={{ fontFamily:IMP, fontSize:18 }}>{member.name}</div>
          <div style={{ fontSize:11, color:'rgba(0,0,0,0.4)', marginTop:1 }}>@{member.handle}</div>
          <div style={{ fontSize:11, color:'rgba(0,0,0,0.5)', marginTop:5 }}>{member.bio}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, margin:'14px clamp(14px,3vw,40px)', background:'rgba(0,0,0,0.06)', borderRadius:10, overflow:'hidden' }}>
          {[{l:'Posts',v:member.posts.length},{l:'Followers',v:member.followers},{l:'Following',v:member.following},{l:'Score',v:member.score}].map(s=>(
            <div key={s.l} style={{ background:'#fff', padding:'8px 0', textAlign:'center' }}>
              <div style={{ fontFamily:IMP, fontSize:15 }}>{s.v.toLocaleString()}</div>
              <div style={{ fontSize:8, color:'rgba(0,0,0,0.4)', letterSpacing:2, textTransform:'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ margin:'0 18px 10px', padding:'8px 12px', background:'#000', borderRadius:10, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>{emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>
              <span>{member.rank}</span><span>{member.score.toLocaleString()}/{target.toLocaleString()}</span>
            </div>
            <div style={{ height:3, background:'rgba(255,255,255,0.15)', borderRadius:2 }}>
              <div style={{ height:'100%', background:'#fff', borderRadius:2, width:`${pct}%`, transition:'width 0.3s' }} />
            </div>
          </div>
        </div>
        <div style={{ padding:'0 18px 10px', display:'flex', justifyContent:'center' }}>
          <button onClick={onFollow} style={{ padding:'7px 28px', borderRadius:20, cursor:'pointer',
            border:isFollowing?'1px solid rgba(0,0,0,0.15)':'none',
            background:isFollowing?'rgba(0,0,0,0.06)':'#000', color:isFollowing?'#000':'#fff',
            fontFamily:IMP, fontSize:11, letterSpacing:2 }}>{isFollowing?'\u2713 Following':'+ Follow'}</button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid rgba(0,0,0,0.07)', margin:'0 18px' }}>
          {['photos','about'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1, padding:'9px 0', border:'none', background:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:2, textTransform:'uppercase',
              borderBottom:tab===t?'2px solid #000':'2px solid transparent',
              color:tab===t?'#000':'rgba(0,0,0,0.3)' }}>{t}</button>
          ))}
        </div>
        <div style={{ padding:16 }}>
          {tab==='photos'?(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {member.posts.map(p=>(
                <div key={p.id} style={{ aspectRatio:'1', borderRadius:8, overflow:'hidden', position:'relative' }}>
                  <img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <span style={{ position:'absolute', bottom:3, left:3, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:8, padding:'2px 5px', borderRadius:3 }}>{'\u2764\uFE0F'} {p.likes}</span>
                </div>
              ))}
            </div>
          ):(
            <div>{[{l:'Handle',v:'@'+member.handle},{l:'Rank',v:member.rank},{l:'Score',v:member.score.toLocaleString()},{l:'Posts',v:member.posts.length},{l:'Followers',v:member.followers.toLocaleString()},{l:'Following',v:member.following}].map(r=>(
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ color:'rgba(0,0,0,0.4)', fontSize:10, letterSpacing:1 }}>{r.l}</span>
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
          onClick={()=>setPage('photos')}
          style={{
            background:'transparent', border:'1px solid rgba(255,255,255,0.4)', borderRadius:2,
            color:'#fff', padding:'12px clamp(40px,10vw,64px)',
            fontFamily:IMP, fontSize:'clamp(12px,3vw,15px)', letterSpacing:6,
            textTransform:'uppercase', cursor:'pointer', minHeight:48,
            transition:'all 0.3s ease', WebkitTapHighlightColor:'transparent',
          }}
          onMouseEnter={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';e.currentTarget.style.letterSpacing='8px'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#fff';e.currentTarget.style.letterSpacing='6px'}}
        >ENTER</button>
        <button
          onClick={openVIP}
          style={{
            marginTop:-16, background:'transparent', border:'none', color:'rgba(255,255,255,0.55)',
            fontFamily:IMP, fontSize:'clamp(10px,2.6vw,12px)', letterSpacing:4, textTransform:'uppercase',
            cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'color 0.25s',
          }}
          onMouseEnter={e=>e.currentTarget.style.color='#fff'}
          onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}
        >{'\u2605'} Join the VIP list {'\u2192'}</button>
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
  const handleHeartSpawn=(pid,x,y)=>{
    const h=Array.from({length:5},(_,i)=>({id:Date.now()+i+Math.random(),x:x+(Math.random()-0.5)*44,y:y-10,
      size:13+Math.random()*14,dur:1.1+Math.random()*0.9,emoji:HEART_EMOJIS[Math.floor(Math.random()*HEART_EMOJIS.length)]}));
    setHeartsByCard(p=>({...p,[pid]:[...(p[pid]||[]),...h]}));
    setTimeout(()=>setHeartsByCard(p=>({...p,[pid]:(p[pid]||[]).filter(b=>!h.includes(b))})),2600);
  };
  const displayList=[...photos,...photos,...photos];
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff' }}>
      <PageHeader setPage={setPage} subtitle="SHARE TO WIN" right={
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>shareAutograff()}
            style={{ background:'rgba(0,0,0,0.04)', color:'rgba(0,0,0,0.5)', border:'1px solid rgba(0,0,0,0.1)',
              width:44, height:44, padding:0, borderRadius:8, fontSize:16, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>{'\uD83D\uDCAC'}</button>
          <button onClick={()=>setShowModal(true)} style={{
            background:'#000', color:'#fff', border:'none', padding:'0 clamp(10px,2vw,16px)', height:44, borderRadius:8,
            fontSize:'clamp(10px,2vw,11px)', cursor:'pointer', fontFamily:IMP, letterSpacing:1,
            flexShrink:0, whiteSpace:'nowrap' }}>+ UPLOAD</button>
        </div>
      } />
      <div style={{ padding:'10px clamp(14px,3vw,40px) 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <span style={{ fontSize:10, color:'rgba(0,0,0,0.35)', letterSpacing:2, fontFamily:IMP }}>{'\u2014'} {photos.length} ENTRIES TODAY</span>
        <span style={{ fontSize:9, color:'rgba(0,0,0,0.25)', letterSpacing:1 }}>Swipe {'\u00B7'} Tap {'\u2764\uFE0F'} to like {'\u00B7'} {'\u2197\uFE0F'} to share</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', overflow:'hidden' }}>
        <div ref={scrollRef} onMouseEnter={()=>pauseRef.current=true} onMouseLeave={()=>pauseRef.current=false}
          style={{ display:'flex', gap:18, overflowX:'scroll', scrollbarWidth:'none', padding:'16px clamp(14px,4vw,64px)',
            alignItems:'center' }}>
          {displayList.map((p,i)=>(
            <PhotoCard key={`${p.id}-${i}`} photo={p} likeCounts={likeCounts} onLike={handleLike}
              onRemove={id=>setPhotos(ps=>ps.filter(x=>x.id!==id))}
              heartBursts={heartsByCard[p.id]||[]} onHeartSpawn={(x,y)=>handleHeartSpawn(p.id,x,y)} />
          ))}
        </div>
      </div>
      <div style={{ padding:'16px clamp(14px,3vw,40px) 80px', display:'flex', flexDirection:'column', alignItems:'center', gap:10, flexShrink:0 }}>
        <div onClick={()=>setShowModal(true)} style={{
          width:56, height:56, borderRadius:'50%', border:'2px dashed rgba(0,0,0,0.15)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
          color:'rgba(0,0,0,0.2)', cursor:'pointer' }}>+</div>
        <span style={{ fontSize:10, color:'rgba(0,0,0,0.25)', letterSpacing:3, fontFamily:IMP }}>DRAG & DROP OR TAP TO UPLOAD</span>
      </div>
      {showModal && <UploadModal onClose={()=>setShowModal(false)} onUpload={photo=>{setPhotos(p=>[photo,...p]);setLikeCounts(p=>({...p,[photo.id]:0}));}} />}
    </div>
  );
}

/* ── LeaderboardPage ── */
function LeaderboardPage({ setPage }) {
  const [view,setView]=useState('photos'); // 'photos' | 'supporters'
  const [voted,setVoted]=useState({});
  const [entries,setEntries]=useState(()=>SEED_PHOTOS.map(p=>({...p,votes:p.likes})).sort((a,b)=>b.votes-a.votes));
  const [supporters,setSupporters]=useState([]);
  const me=myRef();
  useEffect(()=>{
    let active=true;
    // Rank photos by real likes, and build the supporter ledger from liker scores.
    Promise.all([
      fetch('/api/photos').then(r=>r.ok?r.json():{photos:[]}).catch(()=>({photos:[]})),
      fetch('/api/likes').then(r=>r.ok?r.json():{likes:{},likers:{},names:{}}).catch(()=>({likes:{},likers:{},names:{}})),
    ]).then(([pd,ld])=>{
      if(!active) return;
      const seedIds=new Set(SEED_PHOTOS.map(p=>p.id));
      const uploaded=Array.isArray(pd.photos)?pd.photos.filter(p=>p&&p.src&&!seedIds.has(p.id)):[];
      const deltas=(ld&&ld.likes)||{};
      const all=[...uploaded,...SEED_PHOTOS].map(p=>({...p,votes:(p.likes||0)+Number(deltas[p.id]||0)}));
      all.sort((a,b)=>b.votes-a.votes);
      setEntries(all);
      const scores=(ld&&ld.likers)||{}; const names=(ld&&ld.names)||{};
      const sup=Object.keys(scores).map(uid=>({uid,score:Number(scores[uid]||0),name:names[uid]||('guest_'+uid)}));
      sup.sort((a,b)=>b.score-a.score);
      setSupporters(sup);
    });
    return()=>{active=false;};
  },[]);
  const maxVotes=entries[0]?.votes||1;
  const totalVotes=entries.reduce((s,e)=>s+e.votes,0);
  const maxScore=supporters.reduce((m,s)=>Math.max(m,s.score),1);
  const totalGiven=supporters.reduce((s,e)=>s+e.score,0);
  const handleVote=(id)=>{if(voted[id])return;setVoted(p=>({...p,[id]:true}));
    setEntries(p=>p.map(e=>e.id===id?{...e,votes:e.votes+1}:e).sort((a,b)=>b.votes-a.votes));
    // A vote is a like — persist + credit the supporter ledger.
    sendLike(id);
    setSupporters(p=>{const has=p.some(s=>s.uid===me);
      const next=has?p.map(s=>s.uid===me?{...s,score:s.score+1}:s):[...p,{uid:me,score:1,name:myHandle()}];
      return next.sort((a,b)=>b.score-a.score);});};
  const medal=(i)=>i===0?'\uD83E\uDD47':i===1?'\uD83E\uDD48':i===2?'\uD83E\uDD49':`${i+1}`;
  const barColor=(i)=>i===0?'#000':i===1?'rgba(0,0,0,0.45)':i===2?'rgba(0,0,0,0.3)':'rgba(0,0,0,0.12)';
  const fmtV=(v)=>v>=1000?(v/1000).toFixed(1)+'K':v;
  const stagnant=supporters.filter(s=>s.score===0);
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff' }}>
      <PageHeader setPage={setPage} subtitle="THE LEDGER" />
      <div style={{ padding:'6px clamp(14px,3vw,40px) 0', flexShrink:0 }}>
        <p style={{ fontSize:10, color:'rgba(0,0,0,0.4)', letterSpacing:0.5, margin:'0 0 8px' }}>
          We support the liker, we like the supporter. Give love to climb — lurk and you sink.
        </p>
        <div style={{ display:'flex', gap:6 }}>
          {[{k:'photos',l:'\uD83D\uDCF8 MOST LIKED'},{k:'supporters',l:'\u2764\uFE0F TOP SUPPORTERS'}].map(t=>(
            <button key={t.k} onClick={()=>setView(t.k)} style={{
              flex:1, padding:'9px 10px', borderRadius:20, border:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:1,
              background:view===t.k?'#000':'rgba(0,0,0,0.05)', color:view===t.k?'#fff':'rgba(0,0,0,0.5)',
              transition:'all 0.2s' }}>{t.l}</button>
          ))}
        </div>
      </div>

      {view==='photos' ? (
        <div style={{ flex:1, overflow:'auto', padding:'8px 18px 120px' }}>
          {entries.map((e,i)=>{
            const key=e.id;const pct=Math.round(e.votes/maxVotes*100);
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ width:28, fontFamily:IMP, fontSize:i<3?14:16, textAlign:'center', color:i<3?'inherit':'rgba(0,0,0,0.3)' }}>{medal(i)}</span>
                <div style={{ width:60, height:44, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
                  <img src={e.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>{e.title}</div>
                  <div style={{ fontSize:10, color:'rgba(0,0,0,0.4)' }}>@{e.user}</div>
                  <div style={{ height:3, background:'rgba(0,0,0,0.06)', borderRadius:2, marginTop:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:barColor(i), borderRadius:2, width:`${pct}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
                <div style={{ textAlign:'right', minWidth:44 }}>
                  <div style={{ fontFamily:IMP, fontSize:15, fontWeight:700 }}>{fmtV(e.votes)}</div>
                  <div style={{ fontSize:8, color:'rgba(0,0,0,0.35)', letterSpacing:2 }}>LIKES</div>
                </div>
                <button onClick={()=>handleVote(e.id)} disabled={!!voted[key]} style={{
                  padding:'6px 12px', borderRadius:8, fontSize:10, cursor:voted[key]?'default':'pointer',
                  fontFamily:IMP, letterSpacing:1,
                  background:voted[key]?'rgba(0,0,0,0.06)':'transparent',
                  border:`1px solid ${voted[key]?'rgba(0,0,0,0.2)':'rgba(0,0,0,0.15)'}`,
                  color:voted[key]?'rgba(0,0,0,0.4)':'#000' }}>{voted[key]?'\u2713 LIKED':'\u2764\uFE0F LIKE'}</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex:1, overflow:'auto', padding:'8px 18px 120px' }}>
          {supporters.filter(s=>s.score>0).length===0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(0,0,0,0.35)', fontSize:12 }}>
              No supporters yet. Be the first to give love — go like some photos.
            </div>
          )}
          {supporters.filter(s=>s.score>0).map((s,i)=>{
            const pct=Math.round(s.score/maxScore*100); const mine=s.uid===me;
            return (
              <div key={s.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ width:28, fontFamily:IMP, fontSize:i<3?14:16, textAlign:'center', color:i<3?'inherit':'rgba(0,0,0,0.3)' }}>{medal(i)}</span>
                <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0, background:i===0?'#000':'rgba(0,0,0,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontFamily:IMP, fontSize:16,
                  color:i===0?'#fff':'rgba(0,0,0,0.5)' }}>{(s.name||'?').replace(/^guest_/,'').slice(0,2).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>@{s.name}{mine&&<span style={{ fontSize:9, color:'#3ad07a', marginLeft:6 }}>YOU</span>}</div>
                  <div style={{ fontSize:10, color:'rgba(0,0,0,0.4)' }}>{i===0?'Patron of the day':'Supporter'}</div>
                  <div style={{ height:3, background:'rgba(0,0,0,0.06)', borderRadius:2, marginTop:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:barColor(i), borderRadius:2, width:`${pct}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
                <div style={{ textAlign:'right', minWidth:44 }}>
                  <div style={{ fontFamily:IMP, fontSize:15, fontWeight:700 }}>{fmtV(s.score)}</div>
                  <div style={{ fontSize:8, color:'rgba(0,0,0,0.35)', letterSpacing:2 }}>GIVEN</div>
                </div>
              </div>
            );
          })}
          {stagnant.length>0 && (
            <div style={{ marginTop:18, padding:'14px 16px', borderRadius:12, background:'rgba(229,57,53,0.06)', border:'1px dashed rgba(229,57,53,0.35)' }}>
              <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:1, color:'#e53935' }}>{'\uD83E\uDD87'} THE STAGNANT ({stagnant.length})</div>
              <div style={{ fontSize:10, color:'rgba(0,0,0,0.45)', margin:'4px 0 8px' }}>Showed up, watched the show, never gave a like. Zero love. Do better.</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {stagnant.map(s=>(
                  <span key={s.uid} style={{ fontSize:10, fontFamily:IMP, letterSpacing:0.5, padding:'4px 8px', borderRadius:14,
                    background:s.uid===me?'#e53935':'rgba(0,0,0,0.06)', color:s.uid===me?'#fff':'rgba(0,0,0,0.5)' }}>
                    @{s.name}{s.uid===me?' (YOU 💀)':''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position:'absolute', bottom:56, left:0, right:0, padding:'20px clamp(14px,3vw,40px) 8px',
        background:'linear-gradient(transparent, rgba(255,255,255,0.95) 30%, #fff)',
        display:'flex', justifyContent:'space-around', zIndex:10 }}>
        {(view==='photos'
          ? [{l:'TOTAL LIKES',v:fmtV(totalVotes)},{l:'TOP PHOTO',v:entries[0]?.title||'-'},{l:'BY',v:entries[0]?'@'+entries[0].user:'-'}]
          : [{l:'LOVE GIVEN',v:fmtV(totalGiven)},{l:'TOP PATRON',v:supporters[0]?'@'+supporters[0].name:'-'},{l:'STAGNANT',v:stagnant.length}]
        ).map(s=>(
          <div key={s.l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:8, color:'rgba(0,0,0,0.35)', letterSpacing:2, fontFamily:IMP }}>{s.l}</div>
            <div style={{ fontFamily:IMP, fontSize:13, marginTop:2 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── GuestPage (Explore) ── */
function GuestPage({ setPage }) {
  const [expandedTile, setExpandedTile] = useState(null);
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const benefits = [
    { icon:'\uD83D\uDCF7', title:'UPLOAD' },
    { icon:'\u2764\uFE0F', title:'GET LIKES' },
    { icon:'\uD83C\uDFC6', title:'COMPETE' },
    { icon:'\uD83D\uDD12', title:'VAULT' },
    { icon:'\uD83D\uDC64', title:'PROFILE' },
    { icon:'\uD83C\uDF10', title:'COMMUNITY' },
  ];
  const marquee = 'AUTOGRAFF \u00B7 SHARE TO WIN \u00B7 PHOTO CONTEST \u00B7 STREET CULTURE \u00B7 DAILY WINNERS \u00B7 ';
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff', overflow:'auto' }}>
      <PageHeader setPage={setPage} subtitle="EXPLORE" right={
        <button onClick={()=>setPage('profile')} style={{
          background:'#000', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8,
          fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer' }}>JOIN NOW</button>
      } />
      {/* Marquee */}
      <div style={{ background:'#000', padding:'9px 0', overflow:'hidden', flexShrink:0 }}>
        <div style={{ display:'flex', animation:'marqueeText 14s linear infinite', whiteSpace:'nowrap' }}>
          {[0,1,2,3].map(i=>(
            <span key={i} style={{ fontFamily:IMP, fontSize:12, color:'rgba(255,255,255,0.5)', letterSpacing:4 }}>{marquee}</span>
          ))}
        </div>
      </div>
      {/* Trending Now */}
      <div style={{ padding:'14px 0 0 clamp(14px,3vw,40px)', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:3, marginBottom:8, color:'rgba(0,0,0,0.4)' }}>{'\u2014'} {'\uD83D\uDD25'} TRENDING NOW</div>
        <ScrollRow photos={SEED_PHOTOS} speed={0.7} rowHeight={190} cardWidth={280} />
      </div>
      {/* Stats bar */}
      <div style={{ margin:'14px clamp(14px,3vw,40px)', background:'#000', borderRadius:12, padding:'14px 0',
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', flexShrink:0 }}>
        {[{v:'12K+',l:'MEMBERS'},{v:'48K+',l:'PHOTOS'},{v:'200K+',l:'LIKES TODAY'},{v:'Daily',l:'WINNERS'}].map((s,i)=>(
          <div key={s.l} style={{ textAlign:'center', padding:'0 8px', borderRight:i<3?'1px solid rgba(255,255,255,0.1)':'none' }}>
            <div style={{ fontFamily:IMP, fontSize:16, color:'#fff', fontWeight:700 }}>{s.v}</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', letterSpacing:2, marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>
      {/* Most Recent */}
      <div style={{ padding:'0 0 0 clamp(14px,3vw,40px)', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:3, marginBottom:8, color:'rgba(0,0,0,0.4)' }}>{'\u2014'} {'\uD83C\uDD95'} MOST RECENT</div>
        <ScrollRow photos={[...SEED_PHOTOS].reverse()} speed={1.1} rowHeight={150} cardWidth={240} />
      </div>
      {/* Member Benefits */}
      <div style={{ padding:'18px clamp(14px,3vw,40px)', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:3, marginBottom:12, color:'rgba(0,0,0,0.4)' }}>{'\u2014'} MEMBER BENEFITS</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {benefits.map((b,i)=>(
            <div key={i} onClick={()=>setExpandedTile(expandedTile===i?null:i)} style={{
              padding:'18px 10px', borderRadius:12, cursor:'pointer', textAlign:'center', transition:'all 0.2s',
              background:expandedTile===i?'#000':'rgba(0,0,0,0.01)',
              color:expandedTile===i?'#fff':'#000',
              border:expandedTile===i?'none':'1px solid rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize:26 }}>{b.icon}</div>
              <div style={{ fontFamily:IMP, fontSize:11, letterSpacing:2, marginTop:8 }}>{b.title}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Top Rated */}
      <div style={{ padding:'0 0 0 clamp(14px,3vw,40px)', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:12, letterSpacing:3, marginBottom:8, color:'rgba(0,0,0,0.4)' }}>{'\u2014'} {'\u2B50'} TOP RATED</div>
        <ScrollRow photos={[...SEED_PHOTOS.slice(3),...SEED_PHOTOS.slice(0,3)]} speed={1.4} rowHeight={140} cardWidth={200} />
      </div>
      {/* App Store coming soon */}
      <AppStoreBanner style={{ margin:'20px clamp(14px,3vw,40px) 0' }} />
      {/* Join CTA */}
      <div style={{ margin:'20px clamp(14px,3vw,40px) 100px', background:'#000', borderRadius:14, padding:'26px 22px',
        backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px)',
        textAlign:'center', flexShrink:0 }}>
        <div style={{ fontFamily:IMP, fontSize:17, color:'#fff', letterSpacing:3 }}>JOIN THE CONTEST</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:5, letterSpacing:2 }}>UPLOAD {'\u00B7'} COMPETE {'\u00B7'} WIN</div>
        {joined?(
          <div style={{ marginTop:18, fontSize:13, color:'#fff' }}>{'\u2705'} YOU'RE ON THE LIST!</div>
        ):(
          <div style={{ marginTop:18, display:'flex', gap:6, justifyContent:'center' }}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              style={{ padding:'9px 12px', borderRadius:8, border:'none', fontSize:12, outline:'none',
                background:'rgba(255,255,255,0.1)', color:'#fff', width:180 }} />
            <button onClick={()=>{if(email.includes('@'))setJoined(true)}} style={{
              padding:'9px 18px', borderRadius:8, border:'none', background:'#fff', color:'#000',
              fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer' }}>JOIN</button>
          </div>
        )}
        <button onClick={()=>setPage('photos')} style={{
          marginTop:14, background:'none', border:'none', color:'rgba(255,255,255,0.5)',
          fontSize:11, cursor:'pointer', letterSpacing:1 }}>Browse as Guest {'\u2192'}</button>
      </div>
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
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff' }}>
      <PageHeader setPage={setPage} subtitle="MEMBERS" />
      <div style={{ padding:'12px clamp(14px,3vw,40px) 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'rgba(0,0,0,0.03)', borderRadius:10, border:'1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ color:'rgba(0,0,0,0.3)' }}>{'\uD83D\uDD0D'}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..."
            style={{ flex:1, border:'none', background:'none', fontSize:12, outline:'none', fontFamily:'Georgia,serif' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:6, padding:'10px 18px', flexShrink:0, alignItems:'center' }}>
        {filters.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'5px 12px', borderRadius:20, border:filter===f?'none':'1px solid rgba(0,0,0,0.1)', cursor:'pointer',
            fontFamily:IMP, fontSize:10, letterSpacing:1,
            background:filter===f?'#000':'#fff', color:filter===f?'#fff':'rgba(0,0,0,0.5)',
          }}>{f!=='All'?rankEmoji(f)+' ':''}{f.toUpperCase()}</button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(0,0,0,0.3)', fontFamily:IMP, letterSpacing:1 }}>{members.length} MEMBERS</span>
      </div>
      <div style={{ flex:1, overflow:'auto', padding:'0 clamp(14px,3vw,40px) 100px' }}>
        {members.map(m=>(
          <div key={m.id} onClick={()=>setPortfolio(m)} style={{
            display:'flex', alignItems:'center', gap:10, padding:'14px 0', borderBottom:'1px solid rgba(0,0,0,0.05)', cursor:'pointer',
          }}>
            <div style={{ width:56, height:56, borderRadius:'50%', overflow:'hidden', background:'#eee', flexShrink:0, border:'2px solid rgba(0,0,0,0.06)' }}>
              {m.posts[0] && <img src={m.posts[0].src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontFamily:IMP, fontSize:14, fontWeight:700 }}>{m.name}</span>
                <span style={{ fontSize:12 }}>{rankEmoji(m.rank)}</span>
              </div>
              <div style={{ fontSize:10, color:'rgba(0,0,0,0.4)' }}>@{m.handle}</div>
              <div style={{ fontSize:10, color:'rgba(0,0,0,0.45)', marginTop:2 }}>{m.bio}</div>
              <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10 }}>
                <span><b>{m.posts.length}</b> <span style={{ color:'rgba(0,0,0,0.35)' }}>Posts</span></span>
                <span><b>{m.followers >= 1000 ? (m.followers/1000).toFixed(1)+'K' : m.followers}</b> <span style={{ color:'rgba(0,0,0,0.35)' }}>Followers</span></span>
                <span><b>{m.score >= 1000 ? (m.score/1000).toFixed(1)+'K' : m.score}</b> <span style={{ color:'rgba(0,0,0,0.35)' }}>Score</span></span>
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();setFollowing(p=>({...p,[m.id]:!p[m.id]}))}} style={{
              padding:'0 clamp(10px,2vw,16px)', height:44, borderRadius:22, fontSize:10, cursor:'pointer',
              fontFamily:IMP, letterSpacing:1, flexShrink:0,
              background:following[m.id]?'rgba(0,0,0,0.06)':'#1a1a1a', color:following[m.id]?'#000':'#fff',
              border:following[m.id]?'1px solid rgba(0,0,0,0.12)':'none',
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
    setPatterns(p);setBpm(pr.bpm);setSwing(pr.swing);};
  const clearAll=()=>{stop();const p={};TRACK_DEFS.forEach(t=>p[t.id]=new Array(16).fill(false));setPatterns(p);};
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff' }}>
      <PageHeader setPage={setPage} subtitle="STUDIO \u00B7 LOOP MIXER" right={
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={clearAll} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(0,0,0,0.12)',
            background:'#fff', fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer' }}>CLEAR</button>
          <button onClick={playing?stop:start} style={{ padding:'8px clamp(14px,3vw,40px)', borderRadius:8, border:'none',
            background:'#000', color:'#fff', fontFamily:IMP, fontSize:11, letterSpacing:2, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#4fc3f7', fontSize:14 }}>{playing?'\u23F9':'\u25B6'}</span>
            {playing?'STOP':'PLAY'}
          </button>
        </div>
      } />
      {/* Transport */}
      <div style={{ padding:'8px clamp(14px,3vw,40px)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
        <span style={{ fontFamily:IMP, fontSize:10, letterSpacing:2, color:'rgba(0,0,0,0.4)' }}>BPM</span>
        <button onClick={()=>setBpm(Math.max(60,bpm-5))} style={{ width:26, height:26, borderRadius:6, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', cursor:'pointer', fontSize:13, fontFamily:IMP }}>{'\u2212'}</button>
        <span style={{ fontFamily:IMP, fontSize:18, minWidth:36, textAlign:'center', fontWeight:700 }}>{bpm}</span>
        <button onClick={()=>setBpm(Math.min(200,bpm+5))} style={{ width:26, height:26, borderRadius:6, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', cursor:'pointer', fontSize:13, fontFamily:IMP }}>+</button>
        <span style={{ fontFamily:IMP, fontSize:10, letterSpacing:2, color:'rgba(0,0,0,0.4)', marginLeft:6 }}>SWING</span>
        <input type="range" min="0" max="80" value={swing} onChange={e=>setSwing(Number(e.target.value))} style={{ width:60 }} />
        <span style={{ fontFamily:IMP, fontSize:11 }}>{swing}%</span>
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          {Object.keys(PRESETS).map(n=>(
            <button key={n} onClick={()=>loadPreset(n)} style={{
              padding:'4px 10px', borderRadius:6, border:'1px solid rgba(0,0,0,0.12)',
              background:'#fff', fontSize:9, cursor:'pointer', fontFamily:IMP, letterSpacing:1 }}>{n}</button>
          ))}
        </div>
      </div>
      {/* Save button */}
      <div style={{ padding:'6px clamp(14px,3vw,40px)', flexShrink:0 }}>
        <button onClick={()=>setShowSave(!showSave)} style={{
          padding:'5px 12px', borderRadius:6, border:'1px solid rgba(0,0,0,0.12)',
          background:'#fff', fontSize:10, cursor:'pointer', fontFamily:IMP, letterSpacing:1,
          display:'flex', alignItems:'center', gap:4 }}>{'\uD83D\uDCBE'} SAVE</button>
        {showSave && (
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name"
              style={{ flex:1, padding:'5px 8px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:11, outline:'none' }} />
            <button onClick={()=>{if(!saveName.trim())return;
              setSaved(p=>[...p,{name:saveName,patterns:JSON.parse(JSON.stringify(patterns)),bpm,swing}]);
              setSaveName('');setShowSave(false);}} style={{
              padding:'5px 12px', borderRadius:6, border:'none', background:'#000', color:'#fff',
              fontSize:10, cursor:'pointer', fontFamily:IMP }}>OK</button>
          </div>
        )}
        {saved.map((s,i)=>(
          <button key={i} onClick={()=>{stop();const p={};TRACK_DEFS.forEach(t=>p[t.id]=s.patterns[t.id]?[...s.patterns[t.id]]:new Array(16).fill(false));
            setPatterns(p);setBpm(s.bpm);setSwing(s.swing);}} style={{
            display:'block', padding:'4px 8px', marginTop:4, borderRadius:4, border:'1px solid rgba(0,0,0,0.08)',
            background:'#fff', cursor:'pointer', fontSize:10, fontFamily:IMP }}>{'\uD83D\uDCC1'} {s.name}</button>
        ))}
      </div>
      {/* Beat numbers */}
      <div style={{ padding:'0 clamp(14px,3vw,40px)', display:'flex', flexShrink:0 }}>
        <div style={{ width:75, flexShrink:0 }} />
        <div style={{ flex:1, display:'flex' }}>
          {[1,2,3,4].map(n=>(
            <div key={n} style={{ flex:1, textAlign:'center', fontFamily:IMP, fontSize:10, color:'rgba(0,0,0,0.25)', letterSpacing:1 }}>{n}</div>
          ))}
        </div>
        <div style={{ width:135, flexShrink:0 }} />
      </div>
      {/* Step grid — one row per track */}
      <div style={{ flex:1, overflow:'auto', padding:'0 clamp(14px,3vw,40px) 100px' }}>
        {TRACK_DEFS.map(track=>(
          <div key={track.id} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
            {/* Label */}
            <div style={{ width:75, flexShrink:0, display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:12 }}>{track.emoji}</span>
              <span style={{ fontFamily:IMP, fontSize:9, letterSpacing:1, lineHeight:1 }}>{track.name}</span>
            </div>
            {/* 16 step buttons */}
            <div style={{ flex:1, display:'flex', gap:2 }}>
              {(patterns[track.id]||[]).map((on,i)=>(
                <button key={i} onClick={()=>setPatterns(p=>({...p,[track.id]:p[track.id].map((v,j)=>j===i?!v:v)}))} style={{
                  height:28, flex:1, minWidth:0, borderRadius:3, border:'none', cursor:'pointer', transition:'all 0.1s',
                  background: currentStep===i&&playing ? (on?'#fff':'rgba(255,255,255,0.9)') : on?track.color:(i%4===0?'rgba(0,0,0,0.06)':'rgba(0,0,0,0.03)'),
                  outline: currentStep===i&&playing ? `2px solid ${track.color}` : 'none',
                  opacity: muted[track.id]?0.35:1,
                }} />
              ))}
            </div>
            {/* Controls: vol + M + S + dice + × */}
            <div style={{ width:135, flexShrink:0, display:'flex', alignItems:'center', gap:3 }}>
              <input type="range" min="0" max="100" value={Math.round((volumes[track.id]??track.vol)*100)}
                onChange={e=>setVolumes(p=>({...p,[track.id]:e.target.value/100}))} style={{ width:50, flexShrink:0 }} />
              <button onClick={()=>setMuted(p=>({...p,[track.id]:!p[track.id]}))} style={{
                width:26, height:26, borderRadius:4, border:'1px solid rgba(0,0,0,0.1)', fontSize:9, cursor:'pointer',
                fontFamily:IMP, background:muted[track.id]?'#c00':'#fff', color:muted[track.id]?'#fff':'rgba(0,0,0,0.4)' }}>M</button>
              <button onClick={()=>setSolo(p=>p===track.id?null:track.id)} style={{
                width:26, height:26, borderRadius:4, border:'1px solid rgba(0,0,0,0.1)', fontSize:9, cursor:'pointer',
                fontFamily:IMP, background:solo===track.id?'#f90':'#fff', color:solo===track.id?'#fff':'rgba(0,0,0,0.4)' }}>S</button>
              <button onClick={()=>setPatterns(p=>({...p,[track.id]:p[track.id].map(()=>Math.random()>0.65)}))}
                style={{ width:26, height:26, borderRadius:4, border:'1px solid rgba(0,0,0,0.1)', fontSize:11, cursor:'pointer', background:'#fff' }}>{'\uD83C\uDFB2'}</button>
              <button onClick={()=>setPatterns(p=>({...p,[track.id]:new Array(16).fill(false)}))}
                style={{ width:26, height:26, borderRadius:4, border:'1px solid rgba(0,0,0,0.1)', fontSize:10, cursor:'pointer', background:'#fff', color:'rgba(0,0,0,0.3)' }}>{'\u2715'}</button>
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
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#fff' }}>
      <PageHeader setPage={setPage} subtitle="MEMBER PROFILE" />
      <div style={{ flex:1, overflow:'auto', padding:'16px clamp(14px,3vw,40px) 100px' }}>
        {/* Profile card */}
        <div style={{ border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'20px 16px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:14 }}>
          <div style={{ position:'relative' }}>
            <div onClick={()=>avatarRef.current?.click()} style={{
              width:80, height:80, borderRadius:'50%', background:'rgba(0,0,0,0.04)', overflow:'hidden',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px dashed rgba(0,0,0,0.12)',
            }}>
              {avatar ? <img src={avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:32, color:'rgba(0,0,0,0.15)' }}>{'\uD83D\uDC64'}</span>}
            </div>
            <div onClick={()=>avatarRef.current?.click()} style={{
              position:'absolute', bottom:-2, right:-2, width:24, height:24, borderRadius:'50%',
              background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, cursor:'pointer', border:'2px solid #fff' }}>+</div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files[0];if(f)setAvatar(URL.createObjectURL(f))}} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {editingName?(
                <div style={{ display:'flex', gap:4 }}>
                  <input value={username} onChange={e=>setUsername(e.target.value)}
                    style={{ padding:'3px 6px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:4, fontSize:13, fontFamily:IMP, width:100 }} />
                  <button onClick={()=>setEditingName(false)} style={{ padding:'3px 8px', borderRadius:4, border:'none', background:'#000', color:'#fff', fontSize:9, cursor:'pointer', fontFamily:IMP }}>SAVE</button>
                </div>
              ):(
                <>
                  <span style={{ fontFamily:IMP, fontSize:16, fontWeight:700 }}>@{username}</span>
                  <button onClick={()=>setEditingName(true)} style={{ padding:'3px 10px', borderRadius:4,
                    border:'1px solid rgba(0,0,0,0.12)', background:'#fff', fontSize:9, cursor:'pointer', fontFamily:IMP, letterSpacing:1 }}>EDIT</button>
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {[{l:'Posts',v:uploads.length},{l:'Archived',v:archived.length},{l:'Saved',v:collection.length},{l:'Likes',v:totalLikes}].map(s=>(
                <span key={s.l} style={{ padding:'4px 10px', borderRadius:20, background:'rgba(0,0,0,0.04)', fontSize:10, fontFamily:IMP, letterSpacing:1 }}>
                  {s.v} {s.l}
                </span>
              ))}
            </div>
          </div>
          {/* Score badge */}
          <div style={{ background:'#000', borderRadius:12, padding:'12px 14px', textAlign:'center', flexShrink:0, minWidth:72 }}>
            <div style={{ fontSize:18 }}>{rankEmoji}</div>
            <div style={{ fontFamily:IMP, fontSize:'clamp(16px,4vw,20px)', color:'#fff', lineHeight:1, marginTop:4 }}>{score.toLocaleString()}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', letterSpacing:1, marginTop:3 }}>{rank.toUpperCase()}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <span style={{ fontSize:9, fontFamily:IMP, letterSpacing:2, color:'rgba(0,0,0,0.4)' }}>PROGRESS TO NEXT RANK</span>
          <span style={{ fontSize:10, fontFamily:IMP, color:'rgba(0,0,0,0.35)' }}>{score} / {target}</span>
        </div>
        <div style={{ height:4, background:'rgba(0,0,0,0.06)', borderRadius:2, marginBottom:18, overflow:'hidden' }}>
          <div style={{ height:'100%', background:'#000', borderRadius:2, width:`${progress}%`, transition:'width 0.3s' }} />
        </div>
        {/* Tabs + upload */}
        <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0,0,0,0.07)', marginBottom:16 }}>
          {['uploads','archive','collection'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'10px 16px', border:'none', background:'none', cursor:'pointer',
              fontFamily:IMP, fontSize:11, letterSpacing:2, textTransform:'uppercase',
              borderBottom:tab===t?'2px solid #000':'2px solid transparent',
              color:tab===t?'#000':'rgba(0,0,0,0.3)' }}>{t}</button>
          ))}
          <button onClick={()=>setShowModal(true)} style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:8,
            border:'none', background:'#000', color:'#fff', fontFamily:IMP, fontSize:10, letterSpacing:1, cursor:'pointer' }}>+ UPLOAD</button>
        </div>
        {/* Tab content */}
        {tab==='uploads'&&(
          uploads.length===0?(
            <div style={{ textAlign:'center', padding:'50px 0', color:'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCF7'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>NO UPLOADS YET</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {uploads.map(p=>(
                <div key={p.id} style={{ aspectRatio:'1', borderRadius:8, overflow:'hidden', position:'relative' }}>
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
            <div style={{ textAlign:'center', padding:'50px 0', color:'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCC1'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>ARCHIVE EMPTY</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {archived.map((p,i)=>(
                <div key={i} style={{ aspectRatio:'1', borderRadius:8, overflow:'hidden', position:'relative' }}>
                  <img src={p.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <span style={{ position:'absolute', bottom:3, left:3, fontSize:7, background:'rgba(0,0,0,0.6)', color:'#fff', padding:'2px 5px', borderRadius:3 }}>{p.archivedAt}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab==='collection'&&(
          collection.length===0?(
            <div style={{ textAlign:'center', padding:'50px 0', color:'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize:36 }}>{'\uD83D\uDCBE'}</div>
              <div style={{ fontSize:11, marginTop:10, fontFamily:IMP, letterSpacing:2 }}>NOTHING SAVED YET</div>
            </div>
          ):(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {collection.map((p,i)=>(
                <div key={i} style={{ aspectRatio:'1', borderRadius:8, overflow:'hidden' }}>
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
      paddingBottom:'max(14px, env(safe-area-inset-bottom, 14px))',
      background:'#fff', borderTop:'0.5px solid rgba(0,0,0,0.08)',
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
              width:36, height:26, borderRadius:13,
              background:active?'#000':'transparent',
              transition:'background 0.18s',
              fontSize:16, lineHeight:1,
            }}>{item.icon}</span>
            <span style={{
              fontFamily:IMP, fontSize:9, letterSpacing:'0.04em',
              color:active?'#000':'rgba(0,0,0,0.38)',
              transition:'color 0.18s', whiteSpace:'nowrap',
            }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════ ROOT APP ══════════════════════════ */
/* ── VIPModal — VIP waiting list form (name/email/phone/social/bio) ── */
function VIPModal({ onClose, onJoin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [social, setSocial] = useState('');
  const [bio, setBio] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [spots] = useState(() => 34 + Math.floor(Math.random() * 13));
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
    setTimeout(onClose, 3200);
  };
  const field = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, fontFamily:'Georgia,serif', outline:'none', marginBottom:10 };
  const lbl = { display:'block', textAlign:'left', fontFamily:IMP, fontSize:9, letterSpacing:2, color:'rgba(255,255,255,0.4)', marginBottom:5 };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:800, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#000', color:'#fff', borderRadius:18, width:440, maxWidth:'94vw', maxHeight:'92vh', overflowY:'auto', padding:'32px 30px 26px', position:'relative', boxShadow:'0 24px 80px rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onClose} aria-label="Close" style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:20, cursor:'pointer', lineHeight:1, zIndex:2 }}>{'\u2715'}</button>
        {!submitted ? (
          <>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:30, marginBottom:10 }}>{'\uD83D\uDE80'}</div>
              <div style={{ fontFamily:IMP, fontSize:11, letterSpacing:5, color:'#fff', opacity:0.5, marginBottom:12 }}>VIP WAITING LIST {'\u00B7'} COMING TO iOS</div>
              <div style={{ fontFamily:IMP, fontSize:'clamp(23px,6vw,29px)', letterSpacing:1, lineHeight:1.08, marginBottom:12 }}>BE FIRST ON<br/>THE APP STORE</div>
              <div style={{ fontSize:13, lineHeight:1.55, color:'rgba(255,255,255,0.65)', marginBottom:22, maxWidth:340, marginLeft:'auto', marginRight:'auto' }}>
                Complete your profile to join the VIP waiting list. VIPs get in first {'\u2014'} we{'\u2019'}ll notify you the moment AUTOGRAFF hits the App Store, plus the drop date and first look at the designs.
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
            <button onClick={submit} disabled={submitting} style={{ width:'100%', marginTop:6, padding:'15px', border:'none', borderRadius:10, background: submitting?'rgba(255,255,255,0.5)':'#fff', color:'#000', fontFamily:IMP, fontSize:15, letterSpacing:3, cursor: submitting?'default':'pointer', transition:'transform 0.15s' }}
              onMouseEnter={e=>{ if(!submitting) e.currentTarget.style.transform='scale(1.02)'; }} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              {submitting ? 'JOINING\u2026' : <>JOIN THE VIP LIST {'\u2192'}</>}
            </button>
            <div style={{ marginTop:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:10.5, color:'rgba(255,255,255,0.4)', letterSpacing:1 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#3ad07a', boxShadow:'0 0 8px #3ad07a' }} />
              {spots} creators joined today {'\u00B7'} No spam, ever
            </div>
          </>
        ) : (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <div style={{ fontSize:42, marginBottom:14, color:'#3ad07a' }}>{'\u2713'}</div>
            <div style={{ fontFamily:IMP, fontSize:24, letterSpacing:1, marginBottom:10 }}>YOU{'\u2019'}RE ON THE VIP LIST</div>
            <div style={{ fontSize:13, lineHeight:1.55, color:'rgba(255,255,255,0.65)', maxWidth:300, margin:'0 auto' }}>
              {name ? name.split(' ')[0] + ', you' : 'You'}{'\u2019'}re in. We{'\u2019'}ll email you the second AUTOGRAFF hits the App Store {'\u2014'} plus the drop date and first look at the designs. No spam, ever.
            </div>
          </div>
        )}
      </div>
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
    // Manual opens (JOIN VIP button) always work, even after dismiss/join.
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
  return (
    <div style={{ width:'100vw', height:'100vh', background:'#fff', overflow:'hidden', position:'relative', color:'#000' }}>
      {page==='splash'      && <SplashPage setPage={setPage} />}
      {page==='guest'        && <GuestPage setPage={setPage} />}
      {page==='photos'       && <PhotosPage setPage={setPage} />}
      {page==='leaderboard'  && <LeaderboardPage setPage={setPage} />}
      {page==='members'      && <MembersPage setPage={setPage} />}
      {page==='studio'       && <StudioPage setPage={setPage} />}
      {page==='profile'      && <ProfilePage setPage={setPage} />}
      {page!=='splash'       && <NavBar page={page} setPage={setPage} />}
      {page!=='splash'       && <VIPFab />}
      {showVIP && <VIPModal onClose={closeVIP} onJoin={joinVIP} />}
    </div>
  );
}
