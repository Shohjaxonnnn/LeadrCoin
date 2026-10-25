# Orzu Mobile — "YO‘Q" reel

Vertikal reel (1080×1920, 60 fps, 20 s) `index.html` dan kadrma-kadr render qilinadi.

```
npm install
npm run audio    # out/soundtrack.wav (sintez qilingan beat + whoosh/zarba)
npm run render   # out/orzu-mobile-yoq-reel.mp4  (~7 daqiqa, 4 yadro)
```

Tayyor video: `out/orzu-mobile-yoq-reel.mp4`.

## Sahnalar
| Vaqt | Sahna |
|---|---|
| 0–2.5 s | NASIYA — yashirin to‘lovlar bormi? |
| 2.5–11 s | 4 ta "YO‘Q!": boshlang‘ich to‘lov, foiz, jarima, iCloud bloklash |
| 11–14 s | PASPORT + KARTA (20 yoshdan, 12–24 oy) |
| 14–17 s | SOVG‘A: chexol + himoya oynasi + zaryadka |
| 17–20 s | CTA: ariza qoldiring, telefon raqamlar, shartlar individual |

## Uslub
Ranglar Orzu Mobile reels'laridan o‘lchangan (`:root` ichida): label `#2299F5`, matn `#00021C`,
fon `#02081A → #0039B8 → #000`, neon yorug‘lik `#4DB8FF`, oq `#FCFCFC`.

Shrift: Orzu Canva'da **Neue Machina** (Ultrabold / Regular) ishlatadi. U pullik shrift va ochiq
manbalarda yo‘q, shuning uchun hozir eng yaqin ochiq shrift **Bricolage Grotesque** turibdi.
Almashtirish: `index.html` da `--font` o‘zgaruvchisi va `@font-face` (bitta joy).
