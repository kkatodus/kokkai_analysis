# Demo video

Scripts that produced `kokkaidoc_walkthrough.mp4`, the ~2 min walkthrough of
https://www.kokkaidoc.com (1920×1080, 30 fps, with music).

Only the scripts are tracked. Screenshots, recorded frames, titles, music and
the finished MP4 are gitignored and stay local in this directory.

## Requirements

- Node, plus `npm install` here (`playwright-core`, `ffmpeg-static`)
- Google Chrome installed (Playwright launches it with `channel: 'chrome'`)
- A music track in `music/` (any `.mp3`/`.m4a`/`.wav`/`.aac`; the original was
  `nastelbom-technology-422298.mp3`). Without one the video is silent.

## Steps

```sh
npm install
node shots.js        # phone + desktop screenshots of the live site
                     # → desk_app.png, mob_app_full.png (and mob_*.png)
sips -Z 1600 -s format jpeg desk_app.png --out desk.jpg          # 1600×1000
sips --resampleWidth 780 -s format jpeg mob_app_full.png --out mobfull.jpg
node record.js       # drives the live site in Chrome with the fake cursor and
                     # captions from overlay.js → frames/ + frames.json
node titles.js       # per-clip top-right title PNGs → titles/
node build.js kokkaidoc_walkthrough.mp4
```

| File | Role |
|---|---|
| `common.js` | localStorage init script that skips the tutorial and loading overlays |
| `overlay.js` | Injected into the page: fake cursor, click ripple, captions, title cards |
| `devices.js` | "Phone & desktop" slide (CSS 3D laptop + phone using `desk.jpg` / `mobfull.jpg`) |
| `record.js` | The walkthrough itself: scripted clicks, scrolls and clips, screencast to `frames/` |
| `titles.js` | Renders each clip title as a transparent PNG |
| `build.js` | ffmpeg: frames → video, title overlays, music loop extension and fades |
| `analyze.js`, `loopfind.js` | One-off music analysis (tempo; the 8-bar loop at 64.56–79.33 s hard-coded in `build.js`). They read `band1–4.raw`: the track split into four frequency bands as 8 kHz mono float32 PCM |

The camera zoom in `record.js` (`cam()`) is switched off by an early `return`;
`build.js` only applies zoompan when camera keyframes exist.

`build.js` passes `-t` to every looped title input and to the output. Without
it ffmpeg never stops: the looped PNGs are infinite and `-shortest` does not
end a `-filter_complex` graph.
