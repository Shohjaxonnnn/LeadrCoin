# Orzu Mobile reels — handoff (boshqa sessiya uchun)

Repo: `Shohjaxonnnn/LeadrCoin`, branch **`claude/laughing-heisenberg-obe4nn`**, papka **`reel/`**.
Boshlash: `git fetch origin claude/laughing-heisenberg-obe4nn && git checkout claude/laughing-heisenberg-obe4nn && cd reel && npm install`.
Umumiy tuzilma: `reel/README.md`.

## Vazifa
Orzu Mobile uchun **4 ta yangi vertikal reel**: 1080×1920, 60 fps, **har biri 15 soniyadan oshmasin**.
- Ovoz: o‘zbekcha diktor, **Aisha AI**, ovoz **Amir** ("Warm storyteller").
- **Hamma joyda 3D model**, ayniqsa telefonlarda. Modellar **internetdan yuklangan** bo‘lishi kerak, o‘zimiz yasamaymiz.
- Uslub Orzu Mobile Instagram reels'lari bilan 1:1 (ranglar, ko‘rinish, shrift).

## Uslub qoidalari (foydalanuvchi aytgan)
- Ranglar (`kit.css` `:root`): ko‘k yorliq `#2299F5`, yorliq matni `#00021C`, fon `#02081A → #0039B8 → #000`,
  neon yorug‘lik `#4DB8FF`, oq `#FCFCFC`. Katta oq sarlavha + neon glow, ostida ko‘k yorliq.
- Shrift: Orzu Canva'da **Neue Machina** (Ultrabold/Regular). U pullik, hozir o‘rnida **Bricolage Grotesque**
  (`kit.css` dagi `--font`). Foydalanuvchi .otf bersa, almashtiriladi.
- **Logo yuqori chapda** (Orzu: halqa-O + "RZU" + gradient planka + "Mobile").
- **Kerak emas:** yuqori chapdagi "Orzu Mobile" matni, strelka tugmasi, pastdagi chiziqlar va telefon raqamlari qatori.
- CTA sahnada mayda yozuv: "Yakuniy shartlar individual belgilanadi".

## Biznes ma'lumotlari (matnlar shundan, o‘zimizdan shart qo‘shmaymiz)
Halol nasiya (bank va yashirin foizsiz), boshlang‘ich to‘lov yo‘q, 12–24 oy, faqat pasport + plastik karta, 20 yoshdan,
jarima/penya yo‘q. Limit yetmasa, avtomobil texpasporti bilan rasmiylashtiriladi. iCloud bog‘lanmaydi, quti olib qolinmaydi.
Trade-in (eskisi yangisining narxiga hisoblanadi), butun O‘zbekiston bo‘ylab yetkazib berish, har iPhone'ga chexol + himoya
oynasi + zaryadka sovg‘a. Assortiment: iPhone, iPad, MacBook, Dyson, DeLonghi. Yakuniy shartlar individual.

## Videolar (`videos/<nom>/lines.json` — diktor matni)
| Papka | Sahnalar va diktor matni |
|---|---|
| `v2-limit` | "Kartada limit yetmayaptimi?" → "Muammo yo‘q!" → "Avtomobil texpasporti bilan ham rasmiylashtiramiz." → "Orzu Mobile — ariza qoldiring!" |
| `v3-seniki` | "Nasiyaga olingan telefon — kimniki?" → "iCloud bog‘lamaymiz." → "Qutini olib qolmaymiz." → "Qurilma to‘liq sizniki!" → "Orzu Mobile — halol nasiya!" |
| `v4-tradein` | "Eski telefoningiz chang bosyaptimi?" → "Olib keling — yangisining narxiga hisoblaymiz." → "Qolgani — halol nasiyada." → "Orzu Mobile — eskisini topshiring, yangisini oling!" |
| `v5-katalog` | "Faqat iPhone emas!" → "iPad, MacBook, Dyson va DeLonghi ham bor." → "Butun O‘zbekiston bo‘ylab yetkazamiz." → "Orzu Mobile — hammasi halol nasiyada!" |

`v1-yoq` (26 s) avvalroq tayyor bo‘lgan: `videos/v1-yoq/out/orzu-mobile-yoq-reel-voice.mp4`. Unda Gemini "Puck" ovozi bor,
foydalanuvchi u ovozda xatolar ko‘p deb aytgan.

## Ishlash tartibi (kod)
- `kit.css`, `kit.js`: umumiy dvigatel (fon, halqalar, logo, matn bloklari, GSAP timeline, `ctaScene`).
  Sahifa `makeReel(build)` chaqiradi, `window.seek(t)` istalgan kadrni chizadi.
- `videos/<nom>/index.html`: sahnalar. `timing.js` ni `plan.py` yozadi: sahna chegaralari, ovoz boshlanishi, "slam" vaqti.
- `gen_voice.py` (Aisha yoki Gemini) → `plan.py` (ovozni tezlashtirib ≤15 s ga sig‘diradi; `--estimate` ovozsiz taxmin) →
  `audio.py` (musiqa/effekt) → `render.js` (Playwright → ffmpeg, 4 worker) → `mix.py` (ovoz + musiqa ducking, −14 LUFS).
- Hammasi bitta buyruqda: `AISHA_API_KEY=... ./build.sh videos/v2-limit`.
- Ovozsiz ko‘rib chiqish: `cd videos/v2-limit && python3 ../../plan.py --estimate && python3 ../../tools/sheet.py preview.png`.

## Holat
**Tayyor:**
- v2–v5 sahnalari yozilgan va kadrlar bilan tekshirilgan, hozircha **2D rasmlar** bilan, vaqtlar taxminiy (`--estimate`).
- 3D qatlam: `src/kit3d.js` (Three.js, esbuild bilan `kit3d.js` ga yig‘iladi:
  `npx esbuild src/kit3d.js --bundle --format=iife --minify --outfile=kit3d.js`).
  `K3D.init(canvas)`, `K3D.preload([...])`, `K3D.place(model, px, py, scale)` → Node, `K3D.render()`.
  Node'da GSAP tween qilinadigan `x, y, rotationX/Y/Z, rotation, scale, opacity, visible` bor
  (px birlikda, `y` pastga, gradus).
- Foydalanuvchi bergan telefon modellari `assets/models/`: `iphone18-black`, `iphone18-burgundy`, `iphone18-silver` (GLB)
  va `iphone17-orange` (FBX). Hammasi to‘g‘ri chizilishi tekshirilgan, test sahifa: `node tools/bench3d.js tools/test3d/index.html out.jpg`.
- `tools/serve.js`: mahalliy HTTP server. Chromium `file://` da `fetch` qilmaydi, modellar shu orqali yuklanadi.

**Qilinmagan (tartib bilan):**
1. **3D ni videolarga ulash** (`kit.js`):
   - `#vig` va `#scenes` orasiga `<canvas id="gl">` qo‘yish. Glow disklar uchun canvas ostida sahna "orqa qatlam"i kerak,
     hozir ular sahna ichida turibdi.
   - `kit3d.js` ni yuklash, `makeReel` ichida `K3D.init` + `preload` qilish.
   - `mkPhone` ni `mkPhone(a, x, y, scale, model)` → K3D Node qilish. Markaz: `(x+150, y+310)`, `size=scale`.
   - Har Node uchun sahna ko‘rinishini sozlash: `tl.set(node,{visible:false},0)`, `t0` da true, `t1` da false.
   - `window.seek` ichida `K3D.render()` chaqirish.
   - Sahifalardagi eski `mkPhone(id,x,y,scale,cls,tint)` + `a.appendChild(ph)` chaqiruvlarini va v4 dagi `ph.style.filter` ni yangilash.
   - Telefonni tanlash: kumush/qora asosiy, burgundy "yangi telefon", `iphone17-orange` "eski telefon" (v4).
2. **`render.js` va `tools/frames.js`** sahifani `tools/serve.js` orqali ochishi kerak (`srv.url(path.resolve('index.html'))`),
   `bench3d.js` dagidek. Root: `reel/`.
3. **Boshqa 3D modellar kerak** (foydalanuvchi GLB/FBX yuklab berishi kerak; bulut konteyneridan Sketchfab va boshqa
   saytlar yopiq, foydalanuvchining Chrome brauzeri ham ko‘rinmaydi): plastik karta, pasport/ID karta, texpasport yoki avtomobil
   (masalan Chevrolet Cobalt), iPhone qutisi, iPad, MacBook (ochiq), Dyson Supersonic, DeLonghi kofe mashinasi, yetkazib
   berish mashinasi, 3D ikonkalar (✓ belgi, savol belgisi, bulut + qulf). v1 uchun qo‘shimcha: hamyon, foiz, kalendar,
   chexol, himoya oynasi, zaryadka bloki. Format GLB (yoki FBX + teksturalar), tijoriy foydalanish litsenziyasi bilan.
   Har birini `assets/models/<nom>/` ga qo‘yib, `src/kit3d.js` dagi `MODELS` ga qo‘shiladi.
4. **Aisha ovozi**: `back.aisha.group` muhit tarmoq siyosatida yopiq edi. Foydalanuvchi environment → Network access →
   Allowed domains ga `back.aisha.group` ni qo‘shishi kerak. Audio boshqa hostdan kelsa, uni ham qo‘shish kerak.
   API (rasmiy `aisha-ai` npm SDK'dan): `POST https://back.aisha.group/api/v1/tts/post/`, sarlavha `X-Api-Key`,
   multipart `transcript`, `language=uz`, `model=Amir`, `mood` (Neutral/Cheerful/Happy/Sad), `speed` (0.5–2.0).
   Javobda `audio_path` keladi (nisbiy bo‘lsa bazaga qo‘shiladi, `X-Api-Key` bilan yuklanadi). Async holat:
   `GET /api/v1/tts/status/{id}/`. Bularning hammasi `gen_voice.py` da yozilgan. **Kalitni foydalanuvchi beradi**
   (`AISHA_API_KEY`), hech qaysi faylga yozilmaydi.
5. Har video uchun: `./build.sh videos/<nom>`, ≤15 s ekanini tekshirish, kadrlarni ko‘rish, foydalanuvchiga yuborish.

## E'tibor (oldin duch kelgan muammolar)
- GLB iPhone 18 modellarda ekran +z tomonga qaragan. Orqasini ko‘rsatish uchun ichki pivotga `turn: Math.PI` beriladi.
  Node tashqi guruhning aylanishini har kadrda qayta yozadi, shuning uchun `turn` ichki guruhda turishi kerak.
- FBX iPhone 17 da `lens.png` yo‘q. U holatda material qora shishaga almashtiriladi.
- WebGL headless'da SwiftShader orqali ishlaydi: 4 ta telefon bo‘lsa ~1.1–1.4 s/kadr (bitta worker), 15 s video ~6–8 daqiqa.
- Gemini TTS: `languageCode: 'uz-UZ'` bo‘lmasa, Lotin yozuvini turkcha o‘qiydi. Uslub ko‘rsatmalari va `[teg]` lar ovozda
  aytilib ketadi. Bepul reja kuniga har modelga 10 ta so‘rov beradi.
- Kalitlar faqat muhit o‘zgaruvchisida turadi. Commit'dan oldin `grep` bilan tekshiriladi.
