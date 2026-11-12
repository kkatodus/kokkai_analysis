const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { init } = require('./common');
const OVERLAY = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
const OUT = path.join(__dirname, 'frames');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);

let p, mx = 720, my = 405;
const wait = ms => p.waitForTimeout(ms);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
async function moveTo(x, y, ms = 800) {
  const sx = mx, sy = my, n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { const k = ease(i / n); await p.mouse.move(sx + (x - sx) * k, sy + (y - sy) * k); await wait(16); }
  mx = x; my = y;
}
async function center(loc) { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; }
async function clickLoc(loc, ms = 800, dx = 0) { const [x, y] = await center(loc); await moveTo(x + dx, y, ms); await wait(180); await p.mouse.down(); await wait(90); await p.mouse.up(); }
async function scrollWin(y, ms = 1200) {
  await p.evaluate(([y, ms]) => new Promise(r => { const s = scrollY, t0 = performance.now();
    const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [y, ms]);
}
async function wheel(total, ms = 1200) { const n = Math.round(ms / 33); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, total / n); await wait(33); } }
// camera: focus point (CSS px) + zoom, keyframed against wall-clock; applied in post (build.js)
let camCur = { cx: 720, cy: 405, z: 1 }; const camKeys = [];
function cam(cx, cy, z, ms = 900) { return; const t = Date.now() / 1000; camKeys.push({ t, ...camCur }); camCur = { cx, cy, z }; camKeys.push({ t: t + ms / 1000, ...camCur }); }
async function camOn(loc, z, ms = 900, dy = 0) { const b = await loc.boundingBox(); cam(b.x + b.width / 2, b.y + Math.min(b.height, 810 / z) / 2 + dy, z, ms); }
const clips = []; const cap = async (n, t) => { clips.push({ n, t, start: Date.now() / 1000 }); };

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--hide-scrollbars'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(init);
  await ctx.addInitScript(OVERLAY);
  p = await ctx.newPage();
  await p.goto('https://www.kokkaidoc.com/app', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForSelector('[data-tour="search"] input', { timeout: 180000 });
  await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none}*{scrollbar-width:none}' });
  await p.evaluate(() => __v.setup());
  p.setDefaultTimeout(10000);
  await p.evaluate(() => { __v.cursor(false); });
  await p.mouse.move(mx, my);
  await wait(1500);

  // --- start capture
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; const file = path.join(OUT, String(i).padStart(6, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 2880, maxHeight: 1620, everyNthFrame: 1 });
  const marks = {}; const mark = k => marks[k] = Date.now() / 1000;


  const N = 8;
  async function slide(i, kick, ttl, items, prep) {
    const html = `<div class="grid"></div><div class="glow"></div><div class="__brand"><i></i>KOKKAI DOC</div><div class="__pg">${String(i).padStart(2,'0')} / ${String(N).padStart(2,'0')}</div>
      <div class="__sl"><div class="num">${String(i).padStart(2,'0')}</div><div class="body"><div class="kick">${kick}</div><div class="ttl">${ttl}</div><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
      <div class="__prog"><b style="width:${(i-1)/N*100}%"></b></div>`;
    if (clips.length && !clips.at(-1).end) clips.at(-1).end = Date.now() / 1000;
    const showing = await p.evaluate(() => document.getElementById('__card').classList.contains('on'));
    await p.evaluate(() => __v.cursor(false));
    if (showing) { await p.evaluate(() => document.getElementById('__card').classList.add('out')); await wait(520); }
    await p.evaluate(h => __v.card(h), html);
    cam(720, 405, 1, 700);
    await p.evaluate(w => __v.prog(w), i / N * 100);
    const t0 = Date.now();
    if (prep) await prep();
    const left = 2900 - (Date.now() - t0); if (left > 0) await wait(left);
    await p.evaluate(() => { document.getElementById('__card').classList.add('out'); });
    await wait(450);
    await p.evaluate(() => { const c = document.getElementById('__card'); c.classList.remove('on', 'out', 'in'); __v.cursor(true); });
    await wait(500);
  }
  const dp = p.locator('[data-tour="detail-pane"]');
  const tab = name => p.getByRole('tab', { name, exact: true }).first();

  // 0. title
  mark('start');
  await p.evaluate(() => __v.card('<div class="grid"></div><div class="glow"></div><div class="l"><i></i>KOKKAI DOC</div><div class="h">その議員、国会で何してる？</div><div class="sub">国会の会議録をAIで読み解き、議員の仕事ぶりを見える化。</div>'));
  await wait(3600);

  // 1. search
  await slide(1, 'SEARCH', 'あの議員は、国会で何を語ってきた？', ['名前を入れるだけで、国会での活動がわかる', '見出しだけでは伝わらない、本人の言葉に触れる']);
  await cap('1', '議員を名前で検索');
  cam(430, 290, 1.75, 1200);
  const inp = p.locator('[data-tour="search"] input').first();
  await clickLoc(inp, 900, -200);
  await wait(300);
  await inp.pressSequentially('たまき', { delay: 230 });
  await wait(900);
  await clickLoc(p.locator('[data-tour="search"]').getByText('玉木雄一郎').first(), 800);
  cam(1080, 260, 1.6, 1100);
  await p.waitForSelector('[data-tour="speech-card"]', { timeout: 60000 });
  await wait(1500);

  // 2. speeches: widen the side panel, pick 少子化, scroll to a meeting with mixed AI results
  await slide(2, 'SPEECHES', '気になるテーマから、本人の言葉へ。', ['防衛、物価、子育て。関心のあるテーマから', '切り抜きではなく、発言の全文で']);
  await cap('2', '発言をトピック別に');
  const sep = dp.locator('[role="separator"]');
  const sb = await sep.boundingBox();
  await moveTo(sb.x + 4, sb.y + 330, 900); await wait(250); await p.mouse.down();
  await moveTo(330, sb.y + 330, 1100); await p.mouse.up(); await wait(700);
  await clickLoc(dp.locator('button', { hasText: /^少子化$/ }).first(), 900);
  await wait(2200);
  const meetBtns = p.locator('[data-tour="speech-card"] button[title="この発言が行われた会議を開く"]');
  const infos = await meetBtns.evaluateAll(bs => bs.map(b => (b.closest('.flex.items-start')?.parentElement ?? b.parentElement?.parentElement?.parentElement ?? b).innerText));
  let ti = infos.findIndex(t => (t.includes('2023-02-22') || t.includes('2023年2月22日')) && t.includes('予算委員会'));
  if (ti < 0) ti = infos.findIndex(t => t.includes('成果：'));
  const target = meetBtns.nth(Math.max(ti, 0));
  const lb = await p.locator('[data-tour="speech-card"]').boundingBox();
  await moveTo(lb.x + lb.width * 0.55, lb.y + lb.height * 0.6, 700);
  for (let k = 0; k < 40; k++) { const bb = await target.boundingBox(); if (bb && bb.y < 520) break; await p.mouse.wheel(0, 60); await wait(45); }
  await wait(900);

  // 3. meeting
  await slide(3, 'MEETING', 'ひと言だけでなく、議論の流れまで。', ['前後のやり取りまで、会議をまるごと読める', '議論がどこで進んだのか、色でひと目でわかる']);
  await cap('3', '会議の全体を読む');
  await clickLoc(target, 900);
  const dial = p.locator('[role="slider"]').first();
  await dial.waitFor({ timeout: 60000 }); await wait(1200);
  const isep = p.locator('[data-tour="issue-pane"] [role="separator"]');
  const ib0 = await isep.boundingBox();
  await moveTo(ib0.x + 4, ib0.y + 330, 900); await wait(250); await p.mouse.down();
  await moveTo(1100, ib0.y + 330, 1100); await p.mouse.up(); await wait(1000);
  const db = await dial.boundingBox(); const dcx = db.x + db.width / 2, dcy = db.y + db.height / 2, R = db.width * 0.345;
  await moveTo(dcx, dcy - R, 900); await wait(200); await p.mouse.down();
  for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 1.9; mx = dcx + R * Math.sin(a); my = dcy - R * Math.cos(a); await p.mouse.move(mx, my); await wait(30); }
  await p.mouse.up(); await wait(1400);

  // 4. exchange evaluation
  await slide(4, 'AI EVALUATION', 'その質疑に、成果はあったか。', ['新たな事実は出たか、具体的な約束はあったか', '質疑の中身を見極める手がかりに'], async () => {
    await p.locator('[data-tour="issue-pane"] button[aria-label="閉じる"]').first().click().catch(() => {});
    await tab('やり取り').click(); await wait(800);
  });
  await cap('4', 'やり取りの評価（AI判定）');
  cam(1220, 400, 2.1, 1000);
  const [qx1, qy1] = await center(dp);
  await moveTo(qx1, qy1 + 80, 800);
  await wheel(700, 2200); await wait(900);

  // 5. stances
  await slide(5, 'STANCES', '何を訴えてきたのか、すぐにわかる。', ['論点ごとの主張を、発言からAIが要約', '根拠となった発言も、すぐに確認できる'], async () => {
    await tab('立場').click(); await wait(1000);
  });
  await cap('5', '論点ごとの立場');
  cam(1220, 400, 2.1, 1000);
  await clickLoc(dp.locator('button[aria-expanded]', { hasText: /^経済対策/ }).first(), 1000).catch(e => console.error('stance click', e.message));
  await wait(2600);

  // 6. ideology
  const ic = p.locator('[data-tour="ideology-card"]');
  await slide(6, 'IDEOLOGY MAP', '党の看板だけでは、わからないこと。', ['同じ党でも、考え方は人それぞれ', '発言から推定する、一人ひとりの立ち位置'], async () => {
    await dp.locator('button[aria-label="閉じる"]').first().click().catch(() => {});
    const top = await ic.evaluate(e => e.getBoundingClientRect().top + scrollY);
    await p.evaluate(y => scrollTo(0, y), top - 20);
  });
  await cap('6', '政治的な立場の推定');
  await camOn(ic, 1.3, 1100, 60);
  const ib = await ic.boundingBox();
  await moveTo(ib.x + ib.width * .35, ib.y + ib.height * .72, 900);
  await moveTo(ib.x + ib.width * .62, ib.y + ib.height * .62, 1300);
  await wait(400);
  await clickLoc(ic.getByRole('button', { name: '2D', exact: true }), 900);
  await wait(2400);
  await moveTo(ib.x + ib.width * .5, ib.y + ib.height * .62, 1000);
  await wait(1000);

  // 7. ranking
  const qc = p.locator('[data-tour="quality-card"]');
  await slide(7, 'RANKING', '比べると、見えてくる。', ['28の指標で、議員の質疑を比べられる', 'イメージではなく、記録をもとに'], async () => {
    await p.evaluate(() => scrollTo(0, 0));
  });
  await cap('7', '議員ランキング');
  await camOn(qc, 1.55, 1000);
  const sel = qc.locator('select').first();
  await clickLoc(sel, 900);
  const opts = await sel.locator('option').allTextContents();
  const pick = opts.find(o => o.includes('はぐらかし')) || opts.find(o => o.includes('お膳立て')) || opts[3];
  await wait(300); await sel.selectOption({ label: pick });
  await wait(1600);
  const qb = await qc.boundingBox();
  await moveTo(qb.x + qb.width * .5, qb.y + qb.height * .75, 700); await wheel(500, 1600); await wait(700);

  // 8. map
  const mc = p.locator('[data-tour="map-card"]');
  await slide(8, 'MAP', 'あなたの一票と、国会をつなぐ。', ['自分の選挙区の議員が、地図からすぐわかる', '次の選挙で、納得して一票を投じるために'], async () => {
    const top = await mc.evaluate(e => e.getBoundingClientRect().top + scrollY);
    await p.evaluate(y => scrollTo(0, y), top - 20);
  });
  await cap('8', '選挙区地図');
  await camOn(mc, 1.45, 1000, 40);
  const mb = await mc.boundingBox();
  await moveTo(mb.x + mb.width * 0.86, mb.y + mb.height * 0.43, 1000); await wait(200); await p.mouse.down(); await wait(90); await p.mouse.up();
  await wait(2600);
  await clickLoc(mc.getByRole('button', { name: '比例', exact: true }), 900).catch(e => console.error('map click', e.message));
  await wait(2000);

  // outro
  clips.at(-1).end = Date.now() / 1000;
  cam(720, 405, 1, 700);
  await p.evaluate(() => __v.cursor(false));
  // phone & desktop slide
  await p.evaluate(h => __v.card(h), '<div class="grid"></div><div class="glow"></div><div class="__brand"><i></i>KOKKAI DOC</div>' + require('./devices')());
  await wait(5600);
  await p.evaluate(() => document.getElementById('__card').classList.add('out')); await wait(520);
  await p.evaluate(() => __v.card('<div class="grid"></div><div class="glow"></div><div class="l"><i></i>KOKKAI DOC</div><div class="h">国会を、もっと身近に。</div><div class="sub">議員の発言・質疑・立場が、ひと目でわかる。</div><div class="url">kokkaidoc.com</div>'));
  await wait(4500);
  mark('end');
  await cdp.send('Page.stopScreencast');
  await wait(500);
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify({ frames, marks, camKeys, clips }));
  console.log('frames', frames.length, 'dur', (frames.at(-1).t - frames[0].t).toFixed(1), 'wall', (marks.end - marks.start).toFixed(1));
  await b.close();
})().catch(async e => { console.error(e); if (p) await p.screenshot({ path: 'err.png' }).catch(() => {}); process.exit(1); });
