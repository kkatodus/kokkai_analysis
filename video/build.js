// frames.json → MP4 with the camera keyframes applied as an eased zoom/pan (zoompan).
const fs=require('fs');const {execFileSync}=require('child_process');const ff=require('ffmpeg-static');
const out=process.argv[2]||'out.mp4';
const {frames,camKeys,clips}=JSON.parse(fs.readFileSync('frames.json'));
const t0=frames[0].t, S=2, VW=1440, VH=810;
let l='ffconcat version 1.0\n';
for(let i=0;i<frames.length;i++){const d=i<frames.length-1?frames[i+1].t-frames[i].t:0.5;l+=`file '${frames[i].file}'\nduration ${Math.max(d,0.001).toFixed(4)}\n`;}
l+=`file '${frames.at(-1).file}'\n`;fs.writeFileSync('list.txt',l);
// keyframes → clamped top-left (input px) + zoom
const K=camKeys.map(k=>{const w=VW/k.z,h=VH/k.z;const x=Math.min(Math.max(k.cx-w/2,0),VW-w),y=Math.min(Math.max(k.cy-h/2,0),VH-h);return{t:Math.max(0,k.t-t0),z:k.z,x:x*S,y:y*S};});
K.unshift({t:0,z:1,x:0,y:0});
function expr(f){let e=K.at(-1)[f].toFixed(3);
  for(let i=K.length-2;i>=0;i--){const a=K[i],b=K[i+1];const d=Math.max(b.t-a.t,1e-3);
    const p=`clip((it-${a.t.toFixed(3)})/${d.toFixed(3)},0,1)`;
    const seg=a[f]===b[f]?a[f].toFixed(3):`(${a[f].toFixed(3)}+(${(b[f]-a[f]).toFixed(3)})*(${p}*${p}*(3-2*${p})))`;
    e=`if(lt(it,${b.t.toFixed(3)}),${seg},${e})`;}
  return e;}
// clip titles: fixed top-right, fade in/out
const T=clips.map((c,i)=>({f:`titles/${i}.png`,a:c.start-t0+0.15,b:c.end-t0}));
const zoom=K.some(k=>k.z!==1);
let fc=zoom?`[0:v]fps=30,scale=5760:3240:flags=bicubic,zoompan=z='${expr('z')}':x='${expr('x')}*2':y='${expr('y')}*2':d=1:s=1920x1080:fps=30[v0]`:`[0:v]fps=30,scale=1920:1080:flags=lanczos[v0]`;
T.forEach((c,i)=>{fc+=`;[${i+1}:v]format=rgba,fade=t=in:st=${c.a.toFixed(2)}:d=0.45:alpha=1,fade=t=out:st=${(c.b-0.4).toFixed(2)}:d=0.35:alpha=1[t${i}]`;
  fc+=`;[v${i}][t${i}]overlay=x=W-w-28:y=22:enable='between(t,${c.a.toFixed(2)},${c.b.toFixed(2)})'[v${i+1}]`;});
fc+=`;[v${T.length}]format=yuv420p[out]`;
fs.writeFileSync('fc.txt',fc);
const ins=['-safe','0','-f','concat','-i','list.txt'];const total=(frames.at(-1).t-t0+0.5);
T.forEach(c=>ins.push('-loop','1','-framerate','30','-t',total.toFixed(2),'-i',c.f));
const music=fs.readdirSync('music').find(f=>/\.(mp3|m4a|wav|aac)$/i.test(f));
if(music){ins.push('-i','music/'+music);
  // extend the track: repeat 8 bars (64.56s–79.33s, found by loopfind.js) once, beat-matched, 60ms crossfade
  fc+=`;[${T.length+1}:a]asplit[m1][m2];[m1]atrim=0:79.33[p1];[m2]atrim=start=64.56,asetpts=PTS-STARTPTS[p2];[p1][p2]acrossfade=d=0.06[mx]`;
  fc+=`;[mx]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=${(total-3).toFixed(2)}:d=3,volume=0.85[aout]`;
  fs.writeFileSync('fc.txt',fc);}
execFileSync(ff,['-y','-loglevel','error',...ins,'-filter_complex_script','fc.txt','-map','[out]',...(music?['-map','[aout]','-c:a','aac','-b:a','192k']:[]),'-t',total.toFixed(2),'-c:v','libx264','-preset','medium','-crf','20','-movflags','+faststart',out],{stdio:'inherit'});
