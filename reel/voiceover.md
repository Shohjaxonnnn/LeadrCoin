# Diktor matni (voice-over)

Har qator bitta fayl: `voice/01.wav` … `voice/08.wav` (wav yoki mp3). Mikser har birini o‘z vaqtiga qo‘yadi,
shuning uchun har sahnani alohida yozish eng oson va sinxron chiqadi. Pauzasiz, tez, energiyali ("reels" ohangida).

| # | Fayl | Qo‘yiladi | Sig‘ish | Matn |
|---|---|---|---|---|
| 1 | `01` | 0.40 s | ≤ 2.0 s | Nasiya — yashirin to‘lovlar bormi? |
| 2 | `02` | 3.20 s | ≤ 1.7 s | Boshlang‘ich to‘lov? Yo‘q! |
| 3 | `03` | 5.60 s | ≤ 1.3 s | Foiz va ortiqcha to‘lov? Yo‘q! |
| 4 | `04` | 7.60 s | ≤ 1.3 s | Kechiksangiz jarima? Yo‘q! |
| 5 | `05` | 9.60 s | ≤ 1.3 s | iCloud bloklash? Yo‘q! |
| 6 | `06` | 11.30 s | ≤ 2.6 s | Faqat pasport va karta. Yigirma yoshdan, o‘n ikkidan yigirma to‘rt oygacha. |
| 7 | `07` | 14.30 s | ≤ 2.5 s | Har bir iPhone bilan sovg‘a: chexol, himoya oynasi va zaryadka! |
| 8 | `08` | 17.40 s | ≤ 2.4 s | Orzu Mobile — ariza qoldiring, butun O‘zbekistonga yetkazamiz! |

Vaqtlar `index.html` dagi sarlavhalarning chiqish momentiga mos. Klip sig‘ishdan uzun bo‘lsa, mikser
uni kesmaydi, keyingi sahnaga o‘tib ketadi: tezroq o‘qing yoki `mix.py` dagi `START` ni suring.

Keyin: `python3 mix.py voice out/orzu-mobile-yoq-reel.mp4 out/orzu-mobile-yoq-reel-voice.mp4`
