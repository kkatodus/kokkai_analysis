// Injected into the page: fake cursor, click ripple, caption bar, title cards.
(() => {
  const css = `
  #__cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-4px,-3px);transition:opacity .3s;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
  .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #38bdf8;animation:__rip .6s ease-out forwards}
  @keyframes __rip{to{transform:scale(4.2);opacity:0}}
  #__cap{position:fixed;left:0;top:0;transform-origin:50% 100%;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .45s,translate .45s;translate:0 20px;
    background:rgba(2,6,23,.88);border:1px solid rgba(56,189,248,.45);border-radius:18px;padding:14px 30px 16px;box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px rgba(56,189,248,.15);
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;color:#f1f5f9;text-align:center;white-space:nowrap;backdrop-filter:blur(8px)}
  #__cap.on{opacity:1;translate:0 0}
  #__cap .n{display:inline-block;background:linear-gradient(90deg,#22d3ee,#6366f1);color:#020617;font-weight:800;border-radius:999px;padding:2px 12px;margin-right:12px;font-size:17px;vertical-align:4px}
  #__cap .t{font-size:30px;font-weight:800;letter-spacing:.02em}
  #__cap .s{font-size:16px;color:#94a3b8;margin-top:4px}
  #__card{position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .7s;
    background:radial-gradient(ellipse at 50% 40%,rgba(30,41,90,.92),rgba(2,6,23,.97) 70%);backdrop-filter:blur(10px);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;color:#f8fafc}
  #__card.on{opacity:1}
  #__card .l{display:flex;align-items:center;gap:14px;font-size:66px;font-weight:900;letter-spacing:.04em;transform:translateY(20px);opacity:0;transition:all .9s cubic-bezier(.2,.9,.25,1) .15s}
  #__card .l i{width:22px;height:22px;border-radius:50%;background:#3b82f6;box-shadow:0 0 24px #3b82f6}
  #__card .h{font-size:40px;font-weight:800;margin-top:26px;transform:translateY(20px);opacity:0;transition:all .9s cubic-bezier(.2,.9,.25,1) .45s;
     background:linear-gradient(90deg,#67e8f9,#a5b4fc);-webkit-background-clip:text;color:transparent}
  #__card .sub{font-size:20px;color:#94a3b8;margin-top:18px;transform:translateY(20px);opacity:0;transition:all .9s cubic-bezier(.2,.9,.25,1) .75s}
  #__card .url{margin-top:34px;font-size:26px;font-weight:700;color:#e0f2fe;border:1px solid rgba(56,189,248,.5);border-radius:999px;padding:10px 32px;transform:translateY(20px);opacity:0;transition:all .9s cubic-bezier(.2,.9,.25,1) 1s}
  #__card.in .l,#__card.in .h,#__card.in .sub,#__card.in .url{transform:none;opacity:1}

  #__card{background:linear-gradient(135deg,#0b1224 0%,#0f172a 45%,#111c3d 100%)!important;backdrop-filter:none!important}
  #__card .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,184,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.06) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 30% 50%,#000 20%,transparent 75%)}
  #__card .glow{position:absolute;width:700px;height:700px;border-radius:50%;left:-120px;top:-160px;background:radial-gradient(circle,rgba(59,130,246,.28),transparent 65%);animation:__float 6s ease-in-out infinite alternate}
  @keyframes __float{to{transform:translate(80px,60px)}}
  .__sl{position:relative;width:1320px;display:flex;gap:56px;align-items:center}
  .__sl .num{font-size:180px;font-weight:900;line-height:1;background:linear-gradient(180deg,#67e8f9,#6366f1);-webkit-background-clip:text;color:transparent;transform:translateX(-60px);opacity:0;transition:all .8s cubic-bezier(.2,.9,.25,1) .05s}
  .__sl .body{flex:1;border-left:2px solid rgba(99,102,241,.5);padding-left:48px}
  .__sl .kick{font-size:18px;letter-spacing:.3em;color:#38bdf8;font-weight:700;transform:translateY(16px);opacity:0;transition:all .7s cubic-bezier(.2,.9,.25,1) .2s}
  .__sl .ttl{white-space:nowrap;font-size:48px;font-weight:900;margin-top:10px;line-height:1.25;transform:translateY(24px);opacity:0;transition:all .8s cubic-bezier(.2,.9,.25,1) .3s}
  .__sl ul{list-style:none;padding:0;margin:28px 0 0}
  .__sl li{font-size:24px;color:#cbd5e1;margin:12px 0;display:flex;gap:14px;align-items:baseline;transform:translateX(30px);opacity:0;transition:all .7s cubic-bezier(.2,.9,.25,1)}
  .__sl li:before{content:"";flex:none;width:10px;height:10px;border-radius:3px;background:#22d3ee;transform:translateY(-3px)}
  .__sl li:nth-child(1){transition-delay:.6s}.__sl li:nth-child(2){transition-delay:.85s}.__sl li:nth-child(3){transition-delay:1.1s}
  #__card.in .__sl .num,#__card.in .__sl .kick,#__card.in .__sl .ttl,#__card.in .__sl li{transform:none;opacity:1}
  .__prog{position:absolute;left:0;right:0;bottom:0;height:6px;background:rgba(148,163,184,.12)}
  .__prog b{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1);transition:width 1.2s cubic-bezier(.2,.9,.25,1) .3s}
  .__brand{position:absolute;left:48px;top:40px;display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;color:#e2e8f0;letter-spacing:.06em}
  .__brand i{width:10px;height:10px;border-radius:50%;background:#3b82f6;box-shadow:0 0 12px #3b82f6}
  .__pg{position:absolute;right:48px;top:42px;font-size:18px;color:#64748b;font-family:ui-monospace,Menlo,monospace}
  #__card.out .__sl,#__card.out .l,#__card.out .h,#__card.out .sub,#__card.out .url{transform:translateX(-60px)!important;opacity:0!important;transition:all .5s ease-in!important}
  .__brand,.__pg{transition:opacity .5s}
  #__card.out .dv{opacity:0;transform:translateX(-60px);transition:all .5s ease-in}
  `;
  const setup = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cur = document.createElement('div'); cur.id = '__cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.7L21 10.6z" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const cap = document.createElement('div'); cap.id = '__cap'; document.body.appendChild(cap);
    const card = document.createElement('div'); card.id = '__card'; document.body.appendChild(card);
    addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
  };
  window.__v = {
    setup,
    cap(n, t, s) { const c = document.getElementById('__cap'); c.classList.remove('on');
      setTimeout(() => { c.innerHTML = `<div><span class="n">${n}</span><span class="t">${t}</span></div>` + (s ? `<div class="s">${s}</div>` : ''); c.classList.add('on'); }, 250); },
    capOff() { document.getElementById('__cap').classList.remove('on'); },
    card(html) { const c = document.getElementById('__card'); c.classList.remove('in', 'out'); c.innerHTML = html; c.offsetHeight; c.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('in'))); },
    prog(w){const b=document.querySelector('#__card .__prog b');if(b){b.offsetWidth;b.style.width=w+'%';}},
    cardOff() { document.getElementById('__card').classList.remove('on'); },
    // keep the caption at the bottom-centre of the camera's view, at constant on-screen size
    capCam(cx, cy, z, ms) { const c = document.getElementById('__cap'); const w = 1440 / z, h = 810 / z;
      const x = Math.min(Math.max(cx - w / 2, 0), 1440 - w), y = Math.min(Math.max(cy - h / 2, 0), 810 - h);
      c.style.transition = `opacity .45s, translate .45s, transform ${ms}ms cubic-bezier(.45,0,.55,1)`;
      c.style.transform = `translate(${x + w / 2}px, ${y + h - 30 / z}px) translate(-50%,-100%) scale(${1 / z})`; },
    cursor(on) { document.getElementById('__cur').style.opacity = on ? 1 : 0; },
  };
})();
