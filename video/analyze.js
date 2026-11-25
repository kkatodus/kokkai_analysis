const fs=require('fs');const SR=8000,HOP=80; // 10ms frames
const bands=[1,2,3,4].map(i=>{const b=fs.readFileSync(`band${i}.raw`);const x=new Float32Array(b.buffer,b.byteOffset,b.length/4);const n=Math.floor(x.length/HOP);const e=new Float32Array(n);for(let f=0;f<n;f++){let s=0;for(let k=0;k<HOP;k++){const v=x[f*HOP+k];s+=v*v;}e[f]=Math.log(1e-8+s/HOP);}return e;});
const N=bands[0].length;console.log('dur',N/100);
// onset envelope (low+mid flux) -> tempo via autocorrelation
const on=new Float32Array(N);for(let f=1;f<N;f++){let s=0;for(const e of bands)s+=Math.max(0,e[f]-e[f-1]);on[f]=s;}
let best=0,bl=0;for(let l=30;l<=100;l++){let s=0;for(let f=0;f+l<N;f++)s+=on[f]*on[f+l];if(s>best){best=s;bl=l;}}
console.log('beat',bl/100,'s, bpm',(6000/bl).toFixed(1));
// band-energy curve every second for overview
let line='';for(let t=0;t<N/100;t+=2){let s=0;for(let f=t*100;f<Math.min(N,(t+2)*100);f++)s+=bands[0][f]+bands[2][f];line+=`${t}:${(s/200).toFixed(1)} `;}console.log(line);
fs.writeFileSync('feat.json',JSON.stringify({beat:bl}));
