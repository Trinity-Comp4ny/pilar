import * as THREE from './node_modules/three/build/three.module.js';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const KEYS=[[0.0,0.002,0.00,47,0,0.0,1.6],[0.9,0.06,0.05,41,0,0.0,1.3],[2.3,0.86,0.55,25,0,0.6,0.6],[3.8,1.04,0.05,21.5,0,1.0,0.6],[5.3,0.98,-0.85,24,0,1.3,0.0],[6.8,0.78,-1.25,30,0,1.8,0.0],[8.4,0.98,-0.80,37,0,2.0,0.3],[10.0,1.13,-0.40,44,0,1.8,0.7],[12.6,1.15,-0.28,41.5,0,1.8,0.7]];
function camAt(t){let i=0;while(i<KEYS.length-2&&t>KEYS[i+1][0])i++;const k0=KEYS[Math.max(0,i-1)],k1=KEYS[i],k2=KEYS[i+1],k3=KEYS[Math.min(KEYS.length-1,i+2)];
 const u=clamp((t-k1[0])/(k2[0]-k1[0])),dt=k2[0]-k1[0],o=[];for(let c=1;c<7;c++){const m1=(k2[c]-k0[c])/(k2[0]-k0[0]||1)*dt*(i===0?0:1),m2=(k3[c]-k1[c])/(k3[0]-k1[0]||1)*dt*(i+2>=KEYS.length?0:1);const u2=u*u,u3=u2*u;
 o.push((2*u3-3*u2+1)*k1[c]+(u3-2*u2+u)*m1+(-2*u3+3*u2)*k2[c]+(u3-u2)*m2);}return o;}
const cam=new THREE.PerspectiveCamera(36,1080/1920,0.3,200);
const items=JSON.parse(process.argv[2]);
for(const it of items){const fi=Math.round(it.t*30),t=fi/30;let [p,az,r,tx,ty,tz]=camAt(t);p=Math.max(0.002,p);
 cam.position.set(tx+r*Math.sin(p)*Math.sin(az),ty+r*Math.cos(p),tz+r*Math.sin(p)*Math.cos(az));cam.up.set(0,1,0);cam.lookAt(tx,ty,tz);cam.updateMatrixWorld();
 const v=new THREE.Vector3(...it.p).project(cam);console.log(JSON.stringify({...it,frame:fi,sx:Math.round((v.x+1)/2*1080),sy:Math.round((1-v.y)/2*1920)}));}
