const fs=require('fs');const HOP=80;
const B=[1,2,3,4].map(i=>{const b=fs.readFileSync(`band${i}.raw`);const x=new Float32Array(b.buffer,b.byteOffset,b.length/4);const n=Math.floor(x.length/HOP);const e=new Float32Array(n);for(let f=0;f<n;f++){let s=0;for(let k=0;k<HOP;k++){const v=x[f*HOP+k];s+=v*v;}e[f]=Math.log(1e-8+s/HOP);}return e;});
const W=150;let best={c:1e9};
for(let L=1450;L<=1500;L++)for(let t=2000;t+L+W<8800;t++){let c=0;for(let k=-W;k<W;k++)for(const e of B){const d=e[t+k]-e[t+L+k];c+=d*d;}if(c<best.c)best={c,t,L};}
console.log('t1',best.t/100,'L',best.L/100,'cost/frame',(best.c/(2*W*4)).toFixed(3));
