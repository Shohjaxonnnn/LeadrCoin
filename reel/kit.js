/* =====================================================================
   Orzu Mobile reels — shared engine (1080×1920).
   A video page loads timing.js (from plan.py), gsap, this file, then calls
   makeReel(build). build(K) adds the scenes; the timeline is deterministic,
   so window.seek(t) renders any frame (render.js steps through it).
   ===================================================================== */
(function(){
const $ = (s, r=document) => r.querySelector(s);
const el = (tag, cls, html, st) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html!=null) e.innerHTML = html; if (st) Object.assign(e.style, st); return e; };

/* ---------- reusable art ---------- */
function phoneSVG(id, tint){
  tint = tint || ['#E7E8EA','#9A9CA1'];
  return `<svg viewBox="0 0 300 620">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint[0]}"/><stop offset=".55" stop-color="${tint[2]||'#B9BBC0'}"/><stop offset="1" stop-color="${tint[1]}"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#8d9096"/><stop offset="1" stop-color="#eceef1"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".0"/><stop offset="1" stop-color="#7cc4ff" stop-opacity=".25"/></linearGradient>
    <radialGradient id="${id}l" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#3b4a66"/><stop offset=".35" stop-color="#0b1220"/><stop offset="1" stop-color="#02050c"/></radialGradient>
    <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7d9dd"/><stop offset="1" stop-color="#9ea1a8"/></linearGradient>
  </defs>
  <rect x="-3" y="150" width="6" height="52" rx="3" fill="#8d9096"/><rect x="-3" y="222" width="6" height="86" rx="3" fill="#8d9096"/><rect x="-3" y="320" width="6" height="86" rx="3" fill="#8d9096"/><rect x="297" y="250" width="6" height="120" rx="3" fill="#8d9096"/>
  <rect x="0" y="0" width="300" height="620" rx="56" fill="url(#${id}r)"/>
  <rect x="5" y="5" width="290" height="610" rx="52" fill="url(#${id}b)"/>
  <rect x="5" y="5" width="290" height="610" rx="52" fill="url(#${id}s)"/>
  <rect x="22" y="22" width="136" height="136" rx="34" fill="url(#${id}p)" stroke="#f4f5f7" stroke-width="2"/>
  <g>
    <circle cx="62" cy="62" r="29" fill="#14161b" stroke="#c9ccd2" stroke-width="3"/><circle cx="62" cy="62" r="22" fill="url(#${id}l)"/><circle cx="55" cy="55" r="6" fill="#6f86b8" opacity=".6"/>
    <circle cx="62" cy="118" r="29" fill="#14161b" stroke="#c9ccd2" stroke-width="3"/><circle cx="62" cy="118" r="22" fill="url(#${id}l)"/><circle cx="55" cy="111" r="6" fill="#6f86b8" opacity=".6"/>
    <circle cx="118" cy="90" r="29" fill="#14161b" stroke="#c9ccd2" stroke-width="3"/><circle cx="118" cy="90" r="22" fill="url(#${id}l)"/><circle cx="111" cy="83" r="6" fill="#6f86b8" opacity=".6"/>
    <circle cx="130" cy="38" r="8" fill="#f2e7c9"/><circle cx="132" cy="140" r="6" fill="#111"/><circle cx="104" cy="40" r="4" fill="#222"/>
  </g>
  <path d="M60 560 Q150 585 240 560" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none"/>
  </svg>`;
}
const TINT = { silver:null, dark:['#5a5e68','#202329','#3b3f47'], blue:['#7fb4ff','#1d4fae','#3e78d8'] };
function mkPhone(id, x, y, scale, cls, tint){
  const p = el('div','phone '+(cls||''), phoneSVG(id, tint)); p.style.left=x+'px'; p.style.top=y+'px'; p.style.transform=`scale(${scale})`; p.style.transformOrigin='50% 50%'; return p;
}

/* line icons, 240×240 */
const S = (body) => `<svg viewBox="0 0 240 240" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON = {
  wallet: S(`<rect x="22" y="62" width="196" height="132" rx="26"/><path d="M40 62 L168 30 Q184 26 186 44 L188 62"/><path d="M218 112 H166 a22 22 0 0 0 0 44 H218"/><circle cx="168" cy="134" r="5" fill="#fff"/>`),
  percent: S(`<circle cx="120" cy="120" r="96"/><circle cx="84" cy="88" r="17"/><circle cx="156" cy="152" r="17"/><path d="M164 74 L76 166"/>`),
  calendar: S(`<rect x="26" y="48" width="188" height="166" rx="26"/><path d="M26 98 H214M80 28 V66M160 28 V66"/><path d="M120 126 V164"/><circle cx="120" cy="188" r="4" fill="#fff"/>`),
  cloud: S(`<path d="M64 178 a46 46 0 0 1 -6 -91 a62 62 0 0 1 118 -10 a46 46 0 0 1 4 101 H110"/><rect x="104" y="140" width="76" height="58" rx="12" fill="rgba(0,57,184,.6)"/><path d="M122 140 v-16 a20 20 0 0 1 40 0 v16"/><circle cx="142" cy="170" r="5" fill="#fff"/>`),
  box: S(`<path d="M120 24 L210 66 V162 L120 214 L30 162 V66 Z"/><path d="M30 66 L120 108 L210 66M120 108 V214"/>`),
  check: S(`<circle cx="120" cy="120" r="96"/><path d="M74 122 L106 154 L168 88"/>`),
  question: S(`<path d="M44 52 H196 a22 22 0 0 1 22 22 V150 a22 22 0 0 1 -22 22 H112 L70 206 V172 H44 a22 22 0 0 1 -22 -22 V74 a22 22 0 0 1 22 -22 Z"/><path d="M96 98 a24 24 0 1 1 34 22 q-10 5 -10 16 v4"/><circle cx="120" cy="156" r="5" fill="#fff"/>`),
  car: S(`<path d="M24 160 V126 L50 80 H190 L216 126 V160 Z"/><path d="M58 126 H182"/><circle cx="70" cy="166" r="20" fill="rgba(0,57,184,.7)"/><circle cx="170" cy="166" r="20" fill="rgba(0,57,184,.7)"/>`),
  truck: S(`<path d="M18 64 H142 V168 H18 Z"/><path d="M142 100 H188 L222 136 V168 H142"/><circle cx="62" cy="174" r="20" fill="rgba(0,57,184,.7)"/><circle cx="184" cy="174" r="20" fill="rgba(0,57,184,.7)"/>`),
  ipad: S(`<rect x="50" y="22" width="140" height="196" rx="22"/><circle cx="120" cy="196" r="5" fill="#fff"/>`),
  macbook: S(`<rect x="46" y="50" width="148" height="104" rx="12"/><path d="M16 172 H224 L210 192 H30 Z"/>`),
  dryer: S(`<circle cx="120" cy="84" r="58"/><circle cx="120" cy="84" r="24"/><path d="M104 140 V216 H136 V140"/>`),
  coffee: S(`<rect x="44" y="26" width="152" height="44" rx="12"/><path d="M58 70 V216 H182 V70"/><path d="M96 70 V94 H144 V70"/><path d="M92 146 H146 V182 a14 14 0 0 1 -14 14 H106 a14 14 0 0 1 -14 -14 Z"/><path d="M146 156 h10 a11 11 0 0 1 0 22 h-10"/>`),
  arrow: S(`<path d="M24 120 H206 M156 70 L206 120 L156 170"/>`),
  card: S(`<rect x="18" y="58" width="204" height="130" rx="20"/><path d="M18 96 H222"/><path d="M44 152 H100"/>`),
};

/* passport + card + texpasport (documents) */
function passportHTML(){ return `<svg viewBox="0 0 260 360" width="260" height="360">
 <defs><linearGradient id="pp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d3fae"/><stop offset="1" stop-color="#061a5c"/></linearGradient></defs>
 <rect x="4" y="4" width="252" height="352" rx="22" fill="url(#pp)" stroke="#6fb8ff" stroke-width="3"/>
 <g transform="translate(130 122)" fill="none" stroke="#9fd2ff" stroke-width="5"><circle r="52"/><ellipse rx="22" ry="52"/><path d="M-52 0H52M-44 -26H44M-44 26H44"/></g>
 <text x="130" y="238" text-anchor="middle" fill="#cfe8ff" font-size="28" font-weight="700" letter-spacing="5" style="font-family:var(--font)">PASPORT</text>
 <rect x="70" y="268" width="120" height="8" rx="4" fill="#4d8be6" opacity=".7"/><rect x="92" y="290" width="76" height="8" rx="4" fill="#4d8be6" opacity=".5"/></svg>`; }
function cardHTML(id='cc'){ return `<svg viewBox="0 0 400 250" width="400" height="250">
 <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a4d"/><stop offset="1" stop-color="#05091a"/></linearGradient><linearGradient id="${id}chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#d7b45a"/></linearGradient></defs>
 <rect x="3" y="3" width="394" height="244" rx="26" fill="url(#${id})" stroke="#6fb8ff" stroke-width="3"/>
 <rect x="36" y="64" width="62" height="48" rx="9" fill="url(#${id}chip)"/><path d="M36 88H98M67 64V112" stroke="#9b7a22" stroke-width="2"/>
 <text x="36" y="170" fill="#e8f3ff" font-size="30" letter-spacing="4" style="font-family:var(--font);font-weight:500">•••• •••• •••• 0000</text>
 <text x="36" y="216" fill="#7fbfff" font-size="22" letter-spacing="3" style="font-family:var(--font);font-weight:600">PLASTIK KARTA</text>
 <circle cx="330" cy="206" r="22" fill="#2299F5" opacity=".9"/><circle cx="354" cy="206" r="22" fill="#fff" opacity=".7"/></svg>`; }
function texpasportHTML(){ return `<svg viewBox="0 0 420 270" width="420" height="270">
 <defs><linearGradient id="tp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeaff"/><stop offset="1" stop-color="#8fb9f2"/></linearGradient></defs>
 <rect x="3" y="3" width="414" height="264" rx="24" fill="url(#tp)" stroke="#fff" stroke-width="3"/>
 <text x="28" y="54" fill="#0a2a78" font-size="30" font-weight="800" letter-spacing="3" style="font-family:var(--font)">TEXPASPORT</text>
 <g transform="translate(250 92) scale(.62)" fill="none" stroke="#0a2a78" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M24 160 V126 L50 80 H190 L216 126 V160 Z"/><path d="M58 126 H182"/><circle cx="70" cy="166" r="20"/><circle cx="170" cy="166" r="20"/></g>
 <rect x="28" y="92" width="190" height="12" rx="6" fill="#0a2a78" opacity=".55"/><rect x="28" y="124" width="150" height="12" rx="6" fill="#0a2a78" opacity=".4"/>
 <rect x="28" y="156" width="170" height="12" rx="6" fill="#0a2a78" opacity=".4"/><rect x="28" y="206" width="110" height="34" rx="8" fill="#2299F5"/>
 <text x="44" y="230" fill="#fff" font-size="20" font-weight="700" style="font-family:var(--font)">01 A 777 AA</text></svg>`; }

/* ---------- headline + label block ---------- */
function fitText(node, maxW, maxFont){
  let fs = maxFont; node.style.fontSize = fs+'px';
  const w = ()=> node.getBoundingClientRect().width;
  while (w() > maxW && fs > 40) { fs -= 4; node.style.fontSize = fs+'px'; }
  return fs;
}
function makeBlock(scene, o){
  const blk = el('div','txt');
  const wrap = el('div','hl-wrap');
  const hlg = el('div','hlg'+(o.keepCase?' keepcase':''), o.hl);
  const hl = el('div','hl'+(o.keepCase?' keepcase':''));
  [...o.hl].forEach(c=>{ const s=el('span','ch', c===' '?'&nbsp;':c); hl.appendChild(s); });
  wrap.appendChild(hlg); wrap.appendChild(hl);
  blk.appendChild(wrap);
  scene.appendChild(blk);
  const fs = fitText(hl, o.maxW||900, o.maxFont||250);
  hlg.style.fontSize = fs+'px';
  let lab=null, labWrap=null, gsub=null;
  if (o.label){ labWrap = el('div','lab-wrap'); lab = el('div','lab', o.label); labWrap.appendChild(lab); blk.appendChild(labWrap);
    if (o.labelFs){ lab.style.fontSize=o.labelFs+'px'; }
    // fit label inside 960px
    let f = parseInt(getComputedStyle(lab).fontSize); while (lab.getBoundingClientRect().width > 960 && f>34){ f-=2; lab.style.fontSize=f+'px'; } }
  if (o.sub){ gsub = el('div','gsub', o.sub); if (o.subFs) gsub.style.fontSize=o.subFs+'px'; gsub.style.maxWidth='940px'; blk.appendChild(gsub); }
  return {blk, wrap, hl, hlg, chars:[...hl.children], lab, labWrap, gsub};
}

/* ---------- stage markup ---------- */
const LOGO = `<div id="logo">
  <div class="row1">
    <svg width="116" height="80" viewBox="0 0 116 80"><defs><linearGradient id="pg1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9AD2FF"/><stop offset="1" stop-color="#4DA5FF"/></linearGradient></defs>
      <rect x="7" y="7" width="102" height="66" rx="31" fill="none" stroke="#fff" stroke-width="14"/><rect x="34" y="32" width="48" height="16" rx="8" fill="url(#pg1)"/></svg>
    <span class="rzu">RZU</span>
  </div>
  <div class="row2"><i class="bar"></i><span class="mob">Mobile</span></div>
</div>`;
function buildStage(fine){
  $('#stage').innerHTML = `<div id="bg"></div><div id="beams"></div><div id="rings"></div><div id="grain"></div>
  <div id="vig"></div><div id="scenes"></div><div id="flash"></div>
  <div id="chrome">${LOGO}<div id="fine">${fine}</div></div>`;
}

/* =====================================================================
   makeReel(build, {fine})
   ===================================================================== */
window.makeReel = function(build, opts={}){
  window.ready = (async () => {
  await Promise.all([
    document.fonts.load("800 100px Bricolage"), document.fonts.load("700 100px Bricolage"),
    document.fonts.load("500 40px Bricolage"), document.fonts.load("400 40px Bricolage"),
  ]);
  await document.fonts.ready;
  const T = window.TIMING;            // written by plan.py: cuts, voice starts, slam moments
  const DURATION = T.duration;
  buildStage(opts.fine ?? 'Yakuniy shartlar individual belgilanadi');

  /* noise texture */
  (()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); const d=x.createImageData(256,256);
    let s=1234567; const r=()=> (s=(s*1664525+1013904223)>>>0)/4294967296;
    for(let i=0;i<d.data.length;i+=4){const v=r()*255|0; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255}
    x.putImageData(d,0,0); $('#grain').style.backgroundImage=`url(${c.toDataURL()})`; })();

  /* background: beams + rings */
  const beams=[]; for(let i=0;i<5;i++){ const b=el('i'); b.style.left=(60+i*220)+'px'; $('#beams').appendChild(b); beams.push(b); }
  const rings=[]; for(let i=0;i<5;i++){ const r=el('i'); $('#rings').appendChild(r); rings.push(r); }
  function updateBg(t){
    beams.forEach((b,i)=>{ const a=Math.sin(t*.55+i*1.7); b.style.transform=`rotate(${a*13+(i-2)*7}deg)`; b.style.opacity=.35+.35*Math.sin(t*.9+i*2.1)+.2; });
    $('#bg').style.setProperty('--lx', (50+Math.sin(t*.7)*10)+'%');
    rings.forEach((r,i)=>{ const p=((t*.42+i/5)%1); const s=.25+p*3.1; r.style.opacity=(1-p)*(p<.08?p/.08:1)*.9; r.style.width=r.style.height='520px';
      r.style.transform=`translate(-50%,-50%) scale(${s})`; r.style.borderWidth=(7*(1-p)+1)+'px'; });
  }

  /* scenes from the plan */
  const scenesRoot = $('#scenes');
  const SC = T.scenes.map(x=>({...x}));
  SC.forEach(s=>{ s.el=el('div','sc'); s.el.id=s.id; scenesRoot.appendChild(s.el); });

  const tl = gsap.timeline({paused:true});
  const flash = $('#flash');
  /* cut flash on each scene start */
  SC.forEach((s,i)=>{
    if(i===0) return;
    tl.fromTo(flash,{opacity:0},{opacity:.55,duration:.06,ease:'power2.out'}, s.t0)
      .to(flash,{opacity:0,duration:.28,ease:'power2.in'}, s.t0+.06);
  });
  /* scene visibility with quick scale-out */
  SC.forEach((s,i)=>{
    tl.set(s.el,{autoAlpha:1,scale:1}, s.t0);
    if(i<SC.length-1){
      tl.to(s.el,{scale:1.06,duration:.12,ease:'power1.in'}, s.t1-.12);
      tl.set(s.el,{autoAlpha:0}, s.t1);
    }
  });
  tl.set(SC[0].el,{autoAlpha:1},0);

  /* text block in. opts.labelAt / opts.subAt are absolute times (default: shortly after the headline) */
  function blockIn(b, t, o={}){
    const stg = o.stagger ?? .045;
    tl.fromTo(b.chars,{yPercent:115,rotation:6,scale:.7,opacity:0},{yPercent:0,rotation:0,scale:1,opacity:1,duration:.5,ease:'back.out(2.2)',stagger:stg,transformOrigin:'50% 80%'}, t);
    tl.fromTo(b.hlg,{opacity:0},{opacity:.95,duration:.45,ease:'power2.out'}, t+.1);
    tl.fromTo(b.hlg,{scale:1},{scale:1.03,duration:.5,yoyo:true,repeat:3,ease:'sine.inOut',transformOrigin:'50% 50%'}, t+.5);
    if(b.labWrap){
      tl.fromTo(b.lab,{xPercent:-105},{xPercent:0,duration:.38,ease:'expo.out'}, o.labelAt ?? t+.28);
    }
    if(b.gsub){
      tl.fromTo(b.gsub,{opacity:0,y:30,scale:.94},{opacity:1,y:0,scale:1,duration:.5,ease:'power3.out'}, o.subAt ?? t+(b.labWrap?.5:.3));
    }
  }
  /* headline slam: punch-in scale on top of blockIn */
  function slamIn(b, t, o={}){
    blockIn(b, t, {stagger:.06, ...o});
    tl.fromTo(b.wrap,{scale:1.35},{scale:1,duration:.22,ease:'power4.out',transformOrigin:'50% 70%'}, t);
  }

  /* small art helpers */
  const art = (scene, persp) => { const a=el('div','art'+(persp?' persp':'')); scene.appendChild(a); return a; };
  const glowDisc = (a, x, y, d) => { const g=el('div','disc',null,{left:x+'px',top:y+'px',width:d+'px',height:d+'px'}); a.appendChild(g); return g; };
  const icon = (a, name, x, y, size=500) => { const i=el('div','glowsvg',ICON[name],{position:'absolute',left:x+'px',top:y+'px',width:size+'px',height:size+'px'}); a.appendChild(i); return i; };
  const strikeOver = (a, x, y, size=500) => { const s=el('div','glowsvg',`<svg viewBox="0 0 500 500" width="${size}" height="${size}"><path class="sl" d="M70 440 L430 60" stroke="#2299F5" stroke-width="30" stroke-linecap="round" fill="none"/><path class="sl2" d="M70 440 L430 60" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none" opacity=".9"/></svg>`,{position:'absolute',left:x+'px',top:y+'px',width:size+'px',height:size+'px'}); a.appendChild(s); return s; };
  function strikeAt(s, t){
    s.querySelectorAll('.sl,.sl2').forEach(p=>{ const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L,strokeDashoffset:L}); tl.to(p,{strokeDashoffset:0,duration:.2,ease:'power3.in'}, t-.2); });
    tl.fromTo(s,{scale:1.18},{scale:1,duration:.22,ease:'back.out(3)'}, t);
  }
  const discIn = (g, t) => tl.fromTo(g,{scale:.2,opacity:0},{scale:1,opacity:1,duration:.6,ease:'power3.out'}, t);
  const popIn = (e, t, from=.2) => tl.fromTo(e,{scale:from,opacity:0},{scale:1,opacity:1,duration:.45,ease:'back.out(2.4)'}, t);
  const bob = (e, t, dur=1.0, dy=16) => tl.to(e,{y:-dy,duration:dur,yoyo:true,repeat:1,ease:'sine.inOut'}, t);
  const tag = (a, text, x, y) => { const g=el('div','tag',text,{left:x+'px',top:y+'px'}); a.appendChild(g); return g; };
  const fineIn = (t) => tl.fromTo('#fine',{opacity:0},{opacity:.75,duration:.4,ease:'power2.out'}, t);   // fine print, CTA scene

  /* standard CTA scene: phone + sparks + "ORZU MOBILE" block + fine print */
  function ctaScene(sc, o){
    const a = art(sc.el, true);
    const d = glowDisc(a, 120, 330, 840);
    const ph = mkPhone(sc.id+'cta', 390, 340, 1.1, '', o.tint);
    const spk=[]; for(let i=0;i<14;i++){ const s=el('div','abs',null,{left:'540px',top:'700px',width:(8+(i%3)*5)+'px',height:(8+(i%3)*5)+'px',borderRadius:'50%',background:i%2?'#fff':'#4DB8FF',boxShadow:'0 0 18px #4DB8FF'}); a.appendChild(s); spk.push(s); }
    a.append(d, ph);
    const b = makeBlock(sc.el,{hl:o.hl||'ORZU MOBILE', label:o.label, sub:o.sub, maxW:940, maxFont:230, subFs:o.subFs||42});
    const {t0, vs} = sc;
    tl.fromTo(d,{scale:.2,opacity:0},{scale:1,opacity:1,duration:.7,ease:'power3.out'}, t0);
    tl.fromTo(ph,{y:520,rotationY:-80,rotationZ:-18,opacity:0,scale:.7},{y:0,rotationY:-12,rotationZ:-4,opacity:1,scale:1.1,duration:1,ease:'expo.out'}, t0+.05);
    tl.to(ph,{rotationY:14,rotationZ:4,y:-24,duration:Math.max(sc.t1-t0-.7,1),ease:'sine.inOut'}, t0+.7);
    spk.forEach((s,i)=>{ const ang=(i/spk.length)*Math.PI*2+.3, r=330+(i%4)*70;
      tl.fromTo(s,{x:0,y:0,opacity:0,scale:.2},{x:Math.cos(ang)*r,y:Math.sin(ang)*r*.9,opacity:1,scale:1,duration:.5,ease:'power3.out'}, vs+.05)
        .to(s,{opacity:0,y:'+=60',duration:.7,ease:'power1.in'}, vs+.55); });
    blockIn(b, vs, {stagger:.035, labelAt: o.labelAt ?? vs+1.1, subAt: o.subAt ?? vs+1.65});
    fineIn(o.fineAt ?? vs+1.8);
    return {art:a, phone:ph, block:b};
  }

  build({T, SC, tl, gsap, el, $, ICON, TINT, phoneSVG, mkPhone, passportHTML, cardHTML, texpasportHTML,
         makeBlock, fitText, blockIn, slamIn, art, glowDisc, icon, strikeOver, strikeAt, discIn, popIn, bob, tag, fineIn, ctaScene});

  /* global renderer hook */
  window.DURATION = DURATION;
  window.seek = (t)=>{ tl.time(Math.min(Math.max(t,0),DURATION),false); updateBg(t); };
  window.seek(0);
  return true;
  })();
};
})();
