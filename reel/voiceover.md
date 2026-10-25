# Diktor matni (voice-over)

Ovoz: Gemini TTS, ovoz **Puck**, til kodi `uz-UZ` (`gen_voice.py`). Til kodisiz Lotin yozuvi turkchaga
og‘ib ketadi, shuning uchun u majburiy. Klipga 1.2× tezlik beriladi (`plan.py`).

| # | Fayl | Matn |
|---|---|---|
| 1 | `voice/01.wav` | Nasiya — yashirin to‘lovlar bormi? |
| 2 | `voice/02.wav` | Boshlang‘ich to‘lov? Yo‘q! |
| 3 | `voice/03.wav` | Foiz va ortiqcha to‘lov? Yo‘q! |
| 4 | `voice/04.wav` | Kechiksangiz jarima? Yo‘q! |
| 5 | `voice/05.wav` | iCloud bloklash? Yo‘q! |
| 6 | `voice/06.wav` | Faqat pasport va karta kerak. |
| 7 | `voice/07.wav` | Sovg‘a! Har bir iPhone bilan chexol, oyna va zaryadka! |
| 8 | `voice/08.wav` | Orzu Mobile — ariza qoldiring! |

20 yoshdan, 12–24 oy, "butun O‘zbekistonga yetkazamiz" va "shartlar individual" ekranda yoziladi (ovozda aytilmaydi).

## Ovozni almashtirish
Boshqa ovoz (diktor yoki boshqa TTS) uchun 8 ta klipni `raw/01.wav … 08.wav` qilib qo‘ying, keyin:

```
python3 plan.py raw        # tezlik/daraja + timing.js (sahnalar ovoz uzunligiga moslanadi)
python3 audio.py out/soundtrack.wav
node render.js out/video-music.mp4 60 out/soundtrack.wav
python3 mix.py voice out/video-music.mp4 out/orzu-mobile-yoq-reel-voice.mp4 out/soundtrack.wav
```

Matnni o‘zgartirsangiz `gen_voice.py` dagi `LINES` ni ham yangilang.
