# Tonga yaqin — 9:16 stickman animatsiya

`out/tonga-yaqin-9x16.mp4` — tayyor video (1080×1920, 30 fps, original ovoz bilan).

- `scene.js` — butun animatsiya (personaj, kamera, yorug'lik, yomg'ir, matnlar) kod bilan chiziladi.
- `index.html` — brauzerda ochsangiz jonli ko'rinadi (`?t=12` — 12-soniyadan boshlash, bosish — qaytadan).
- `render.mjs` — kadrlarni Chromium'da chizib, ffmpeg bilan MP4 qiladi:

```
node render.mjs <ovoz-manbasi.mp4> out/tonga-yaqin-9x16.mp4
```

Shrift: Montserrat (SIL Open Font License, `fonts/`).
