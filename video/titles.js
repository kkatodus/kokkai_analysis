// Renders each clip's top-right title as a transparent PNG (output-pixel size).
const fs = require('fs'); const { chromium } = require('playwright-core');
(async () => {
  const { clips } = JSON.parse(fs.readFileSync('frames.json'));
  fs.mkdirSync('titles', { recursive: true });
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1200, height: 200 } });
  for (const [i, c] of clips.entries()) {
    await p.setContent(`<html><body style="margin:0;background:transparent"><div id="t" style="display:inline-flex;align-items:center;gap:16px;padding:14px 28px 14px 16px;margin:24px;
      background:rgba(2,6,23,.86);border:1.5px solid rgba(56,189,248,.5);border-radius:999px;box-shadow:0 12px 40px rgba(0,0,0,.55),0 0 28px rgba(56,189,248,.18);
      font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif;color:#f1f5f9">
      <span style="background:linear-gradient(90deg,#22d3ee,#6366f1);color:#020617;font-weight:900;font-size:22px;border-radius:999px;padding:5px 14px;font-family:ui-monospace,Menlo,monospace">${String(c.n).padStart(2, '0')}</span>
      <span style="font-size:32px;font-weight:800;letter-spacing:.02em">${c.t}</span></div></body></html>`);
    await p.locator('#t').screenshot({ path: `titles/${i}.png`, omitBackground: true });
  }
  await b.close(); console.log('titles', clips.length);
})();
