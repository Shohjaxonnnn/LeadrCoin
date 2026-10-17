// Shared timeline engine for Terabayt24 videos.
// Page defines window.BUILD = (api) => {...}; engine loads timeline.json, adds chrome, runs BUILD.
const E = { out: 'cubic-bezier(.16,1,.3,1)', back: 'cubic-bezier(.34,1.56,.64,1)', in: 'cubic-bezier(.6,0,.9,.4)', io: 'cubic-bezier(.65,0,.35,1)', lin: 'linear' };
const $ = (id) => document.getElementById(id);
const LOGO = '<svg width="62" height="52" viewBox="0 0 62 52"><path d="M2 6 Q2 2 6 2.6 L27 6 Q30 6.6 30 10 L30 49 Q30 51 27 50.4 L6 47 Q2 46.4 2 42Z" fill="#02f894"/><path d="M60 6 Q60 2 56 2.6 L35 6 Q32 6.6 32 10 L32 49 Q32 51 35 50.4 L56 47 Q60 46.4 60 42Z" fill="#02f894"/></svg>';
const CHECK = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#032b22" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
window.SFX = []; const hooks = [];

function A(id, frames, t, dur, ease = 'out', extra = {}) {
  const el = typeof id === 'string' ? $(id) : id;
  if (!el) throw new Error('no element ' + id);
  el.animate(frames, Object.assign({ delay: t * 1000, duration: dur * 1000, easing: E[ease] || ease, fill: 'both' }, extra));
}
const sfx = (type, t, o = {}) => window.SFX.push(Object.assign({ type, t: +t.toFixed(3) }, o));
const lineIn = (id, t, d = 0.75) => A(id, [{ transform: 'translateY(140%)' }, { transform: 'none' }], t, d);
const pop = (id, t, d = 0.6, s) => { A(id, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], t, d, 'back'); if (s) sfx('pop', t + 0.03, s); };
const rise = (id, t, d = 0.7, y = 60) => A(id, [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], t, d);
const slideX = (id, t, x = -60, d = 0.6) => A(id, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: 'none' }], t, d);
const fadeIn = (id, t, d = 0.5) => A(id, [{ opacity: 0 }, { opacity: 1 }], t, d, 'io');
const pulse = (id, t, n = 4, s = 1.05, d = 0.5) => A(id, [{ transform: 'scale(1)' }, { transform: `scale(${s})` }], t, d, 'io', { iterations: n, direction: 'alternate', composite: 'add' });
const float = (id, t, n = 6, y = 14, d = 1.1) => A(id, [{ transform: 'translateY(0)' }, { transform: `translateY(${-y}px)` }], t, d, 'io', { iterations: n, direction: 'alternate', composite: 'add' });

function chrome(pill) {
  const st = $('stage');
  st.insertAdjacentHTML('afterbegin', `<div class="glow" id="glow"></div><div class="grain"></div>
  <div class="abs" id="shapeL" style="left:-80px;top:1480px;width:640px;height:600px;background:linear-gradient(160deg,#06a868,#03603f);clip-path:polygon(0 18%,55% 0,100% 0,62% 100%,0 100%);opacity:.9"></div>
  <div class="abs" id="shapeR" style="left:900px;top:1560px;width:300px;height:500px;background:linear-gradient(170deg,#19ffa8,#02f894);clip-path:polygon(70% 0,100% 0,100% 100%,0 100%)"></div>
  <div id="header"><div class="logo">${LOGO}<span>TERABAYT24</span></div><div class="pill">${pill}</div></div>`);
}

async function boot() {
  const TL = await (await fetch('timeline.json')).json();
  if (window.USE3D) { while (!window.PHONE3D) await new Promise((r) => setTimeout(r, 50)); await window.PHONE3D.ready; }
  const S = (i) => TL.starts[i], End = (i) => TL.starts[i + 1], V = (i) => TL.voice[i];
  const n = TL.voice.length;
  chrome(window.PILL || 'HALOL NASIYA');
  A('header', [{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'none' }], 0.05, 0.7);
  A('shapeL', [{ transform: 'translateY(500px)' }, { transform: 'none' }], 0.15, 0.9);
  A('shapeR', [{ transform: 'translate(200px,400px)' }, { transform: 'none' }], 0.25, 0.9);
  A('glow', [{ transform: 'translate(-120px,-60px) scale(.9)' }, { transform: 'translate(120px,60px) scale(1.1)' }], 0, 6, 'io', { iterations: 4, direction: 'alternate' });
  for (let i = 1; i < n; i++)
    $('shapeL').animate([{ transform: 'none' }, { transform: `translateY(${i % 2 ? 30 : -30}px)` }, { transform: 'none' }], { delay: (S(i) - 0.2) * 1000, duration: 700, easing: E.io, composite: 'add' });
  const exit = (i) => { if (i < n - 1) A('s' + i, [{ opacity: 1, transform: 'none', filter: 'blur(0px)' }, { opacity: 0, transform: 'translateY(-80px) scale(.98)', filter: 'blur(8px)' }], End(i) - 0.3, 0.3, 'in'); };
  const api = { TL, S, End, V, n, A, sfx, lineIn, pop, rise, slideX, fadeIn, pulse, float, exit, $, E, LOGO, CHECK, hook: (f) => hooks.push(f) };
  await document.fonts.ready;
  window.BUILD(api);
  for (let i = 0; i < n; i++) exit(i);
  window.render = (t) => {
    for (let i = 0; i < n; i++) { const el = $('s' + i); el.style.visibility = (t >= S(i) - 0.001 && t < End(i)) ? 'visible' : 'hidden'; }
    hooks.forEach((f) => f(t));
    document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * 1000; });
    if (window.render3d) window.render3d(t);
  };
  window.TLEND = TL.end;
  window.render(0);
  if (window.WAIT3D) await window.WAIT3D;
  await document.fonts.ready;
  window.READY = true;
}
boot();
