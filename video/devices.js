// "Phone & desktop" slide: CSS-3D laptop and phone angled toward each other.
const fs = require('fs');
const b64 = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
module.exports = () => {
  const desk = b64(__dirname + '/desk.jpg'), mob = b64(__dirname + '/mobfull.jpg');
  const layers = (n, cls) => Array.from({ length: n }, (_, i) => `<div class="${cls}" style="transform:translateZ(${-(i + 1)}px)"></div>`).join('');
  return `<style>
  .dv{position:absolute;inset:0;perspective:2000px;perspective-origin:50% 35%;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif}
  .dv .hd{position:absolute;left:0;right:0;top:70px;text-align:center;z-index:5}
  .dv .k{font-size:18px;letter-spacing:.3em;color:#38bdf8;font-weight:700;opacity:0;transform:translateY(14px);transition:all .7s cubic-bezier(.2,.9,.25,1) .1s}
  .dv .t{font-size:56px;font-weight:900;color:#f8fafc;margin-top:8px;opacity:0;transform:translateY(20px);transition:all .8s cubic-bezier(.2,.9,.25,1) .2s}
  .dv .s{font-size:22px;color:#94a3b8;margin-top:10px;opacity:0;transform:translateY(20px);transition:all .8s cubic-bezier(.2,.9,.25,1) .4s}
  #__card.in .dv .k,#__card.in .dv .t,#__card.in .dv .s{opacity:1;transform:none}
  .dv .floor{position:absolute;left:50%;top:560px;width:1500px;height:300px;margin-left:-750px;background:radial-gradient(ellipse at center,rgba(56,189,248,.10),transparent 60%)}
  /* no opacity on the 3D groups: opacity<1 flattens preserve-3d and the stand would draw over the screen */
  /* laptop */
  .stage{position:absolute;left:0;top:285px;width:1440px;height:700px;transform:scale(.72);transform-origin:50% 0;transform-style:preserve-3d}
  .lap{position:absolute;left:150px;top:-20px;width:800px;transform-style:preserve-3d;
       transform:translateX(-1500px) rotateY(-48deg) rotateX(10deg);transition:transform 1.5s cubic-bezier(.16,.84,.3,1) .25s}
  #__card.in .lap{transform:rotateY(-22deg) rotateX(10deg);animation:__lapf 6s ease-in-out 1.8s infinite alternate}
  @keyframes __lapf{to{transform:rotateY(-17deg) rotateX(9deg) translateY(-6px)}}
  .lid{position:relative;width:800px;height:510px;border-radius:16px;background:#0b0f19;padding:14px;box-sizing:border-box;transform-style:preserve-3d;
       box-shadow:inset 0 0 0 2px #2a2f3a,inset 0 0 0 3px #11151f}
  .lid .scr{position:relative;width:100%;height:100%;border-radius:6px;overflow:hidden;background:url(${desk}) center top/cover;transform:translateZ(.5px)}
  .lid .cam{position:absolute;left:50%;top:7px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#1e293b;box-shadow:0 0 0 1px #334155}
  .lidl{position:absolute;inset:0;border-radius:16px;background:linear-gradient(135deg,#c9ced6,#8b919b 50%,#b7bcc4)}
  .neck{position:absolute;left:50%;top:380px;width:120px;height:250px;margin-left:-60px;transform:translateZ(-40px);border-radius:8px;
        background:linear-gradient(90deg,#8b919b,#d3d7dd 45%,#a2a8b1)}
  .foot{position:absolute;left:50%;top:615px;width:340px;height:230px;margin-left:-170px;transform-origin:50% 0;transform:translateZ(-40px) rotateX(90deg) translateY(-115px);
        border-radius:20px;background:linear-gradient(180deg,#c9ced6,#a7adb6)}
  .lap .sh{position:absolute;left:120px;right:120px;top:600px;height:120px;background:radial-gradient(ellipse at center,rgba(0,0,0,.65),transparent 70%);filter:blur(10px);transform:translateZ(-1px)}
  /* phone */
  .ph{position:absolute;left:1080px;top:0px;width:300px;height:620px;transform-style:preserve-3d;
      transform:translateX(1500px) rotateY(50deg) rotateX(6deg);transition:transform 1.5s cubic-bezier(.16,.84,.3,1) .45s}
  #__card.in .ph{transform:rotateY(24deg) rotateX(6deg) rotateZ(-2deg);animation:__phf 5s ease-in-out 2s infinite alternate}
  @keyframes __phf{to{transform:rotateY(19deg) rotateX(7deg) rotateZ(-2deg) translateY(-10px)}}
  .ph .body{position:absolute;inset:0;border-radius:52px;background:#05070c;padding:12px;box-sizing:border-box;
      box-shadow:inset 0 0 0 2px #3a404c,inset 0 0 0 4px #0a0d14;transform:translateZ(1px)}
  .ph .scr{position:relative;width:100%;height:100%;border-radius:41px;overflow:hidden;background:#020617}
  .ph .scr img{position:absolute;left:0;top:0;width:100%;animation:__scroll 9s cubic-bezier(.45,0,.55,1) 1.8s forwards}
  @keyframes __scroll{to{transform:translateY(-38%)}}
  .ph .isl{position:absolute;left:50%;top:22px;width:96px;height:28px;margin-left:-48px;border-radius:20px;background:#000;z-index:2}
  .ph .edge{position:absolute;inset:0;border-radius:52px;background:linear-gradient(90deg,#6b7280,#d1d5db 30%,#9ca3af 60%,#4b5563)}
  .ph .btn{position:absolute;width:4px;border-radius:3px;background:linear-gradient(90deg,#9ca3af,#e5e7eb);transform:translateZ(-7px)}
  .ph .sh{position:absolute;left:-30px;right:-30px;top:600px;height:90px;background:radial-gradient(ellipse at center,rgba(0,0,0,.7),transparent 70%);filter:blur(10px);transform:translateZ(-20px)}
  .glare{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.04) 28%,transparent 42%);border-radius:inherit;z-index:3}
  </style>
  <div class="dv"><div class="floor"></div>
    <div class="hd"><div class="k">ANYWHERE</div><div class="t">スマホでも、パソコンでも。</div><div class="s">通勤中にさっと、家でじっくりと。</div></div>
    <div class="stage"><div class="lap"><div class="sh"></div>
      <div class="lid">${layers(6, 'lidl')}<div class="cam"></div><div class="scr"><div class="glare"></div></div></div>
      <div class="neck"></div><div class="foot"></div></div>
    <div class="ph"><div class="sh"></div>${layers(14, 'edge')}
      <div class="btn" style="left:-3px;top:120px;height:34px"></div><div class="btn" style="left:-3px;top:170px;height:60px"></div><div class="btn" style="left:-3px;top:240px;height:60px"></div><div class="btn" style="right:-3px;top:180px;height:90px"></div>
      <div class="body"><div class="scr"><div class="isl"></div><img src="${mob}"><div class="glare"></div></div></div></div></div>
  </div>`;
};
