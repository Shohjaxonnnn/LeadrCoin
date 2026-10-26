# Orzu Mobile reels

Vertikal reellar (1080×1920, 60 fps) HTML'dan kadrma-kadr render qilinadi. O‘zbekcha diktor ovozi bilan.

```
reel/
  kit.css, kit.js        umumiy dvigatel: fon, logo, telefon, ikonkalar, matn bloklari, timeline, CTA sahnasi
  gen_voice.py           diktor klipi (Aisha AI yoki Gemini), lines.json dan
  plan.py                ovoz -> timing.js (sahnalar ovozga moslanadi, maxDuration dan oshmaydi)
  audio.py, mix.py       musiqa/effektlar va ovozni aralashtirish
  render.js              Playwright -> ffmpeg
  build.sh               bitta videoni boshidan oxirigacha yig‘adi
  videos/
    v1-yoq/              NASIYA → 4× YO‘Q! → PASPORT + KARTA → SOVG‘A (26 s, Gemini Puck)
    v2-limit/            LIMIT → MUAMMO YO‘Q! → TEXPASPORT (≤15 s, Aisha Amir)
    v3-seniki/           KIMNIKI? → iCloud → QUTI → SIZNIKI! (≤15 s)
    v4-tradein/          ESKI TELEFON → TRADE-IN → QOLGANI nasiyada (≤15 s)
    v5-katalog/          EMAS! → HAMMASI BOR → YETKAZAMIZ (≤15 s)
```

Har bir video papkasida: `index.html` (sahnalar), `lines.json` (diktor matni, ovoz, vaqt sozlamalari),
`timing.js` (plan.py yozadi), `raw/` (asl ovoz), `voice/` (tayyor ovoz), `out/` (tayyor video).

```
npm install
AISHA_API_KEY=... ./build.sh videos/v2-limit       # ~5 daqiqa (4 yadro)
```

Ovozsiz ko‘rib chiqish: `cd videos/v2-limit && python3 ../../plan.py --estimate && python3 ../../tools/sheet.py preview.png`.
Kalitlar faqat muhit o‘zgaruvchisida, hech qaysi faylga yozilmaydi.

## Uslub
Ranglar Orzu Mobile reels'laridan o‘lchangan (`kit.css` `:root`): label `#2299F5`, matn `#00021C`,
fon `#02081A → #0039B8 → #000`, neon yorug‘lik `#4DB8FF`, oq `#FCFCFC`. Logo yuqori chapda.

Shrift: Orzu Canva'da **Neue Machina** ishlatadi (pullik). Hozir eng yaqin ochiq shrift **Bricolage Grotesque**;
almashtirish `kit.css` dagi `--font` va `@font-face`.
