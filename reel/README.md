# Orzu Mobile — "YO‘Q" reel

Vertikal reel (1080×1920, 60 fps, ~26 s, o‘zbekcha diktor ovozi bilan). `index.html` dan kadrma-kadr render qilinadi.
Tayyor video: `out/orzu-mobile-yoq-reel-voice.mp4`.

```
npm install
GEMINI_API_KEY=... python3 gen_voice.py raw      # 8 ta diktor klipi (kalit faqat muhitda, faylga yozilmaydi)
python3 plan.py raw                              # voice/*.wav + timing.js (sahnalar ovozga moslanadi)
python3 audio.py out/soundtrack.wav              # musiqa/effektlar (timing.js ga bog‘langan)
node render.js out/video-music.mp4 60 out/soundtrack.wav   # ~8 daqiqa, 4 yadro
python3 mix.py voice out/video-music.mp4 out/orzu-mobile-yoq-reel-voice.mp4 out/soundtrack.wav
```

`timing.js` yagona manba: sahna chegaralari, ovoz boshlanishi va "Yo‘q!" zarbasi vaqti. Animatsiya, effektlar va
mikser hammasi shundan o‘qiydi, shuning uchun rasm va ovoz doim mos tushadi.

## Sahnalar
NASIYA (savol) → 4 ta "YO‘Q!" (boshlang‘ich to‘lov, foiz, jarima, iCloud) → PASPORT + KARTA → SOVG‘A (chexol, oyna,
zaryadka) → ORZU MOBILE, ariza qoldiring. Matnlar: `voiceover.md`.

## Uslub
Ranglar Orzu Mobile reels'laridan o‘lchangan (`index.html` `:root`): label `#2299F5`, matn `#00021C`,
fon `#02081A → #0039B8 → #000`, neon yorug‘lik `#4DB8FF`, oq `#FCFCFC`.

Shrift: Orzu Canva'da **Neue Machina** (Ultrabold / Regular) ishlatadi. U pullik shrift, ochiq manbalarda yo‘q,
shuning uchun hozir eng yaqin ochiq shrift **Bricolage Grotesque** turibdi. Almashtirish: `--font` va `@font-face`.
