// ---------- GEOMETRIA ÚNICA DA PLANTA (fonte para a textura 2D E para o 3D) ----------
const EXT = 0.25, INT = 0.15;
const walls = [
  { id:'topo',     x:[-0.125, 9.125], z:[-0.125, 0.125], axis:'x', dir:+1,
    open:[{s:0.9,e:2.7,type:'win',sill:1.0,head:2.2},{s:4.2,e:5.0,type:'win',sill:1.6,head:2.2},{s:6.4,e:8.2,type:'win',sill:1.0,head:2.2}] },
  { id:'direita',  x:[8.875, 9.125], z:[0.125, 11.875], axis:'z', dir:+1,
    open:[{s:1.2,e:3.0,type:'win',sill:1.0,head:2.2},{s:6.0,e:9.5,type:'win',sill:0.3,head:2.4}] },
  { id:'frente',   x:[-0.125, 9.125], z:[11.875, 12.125], axis:'x', dir:-1,
    open:[{s:1.2,e:3.6,type:'win',sill:1.0,head:2.2},{s:3.9,e:4.9,type:'door',head:2.2,swing:-1,hinge:'s'},{s:7.3,e:8.4,type:'win',sill:1.0,head:2.2}] },
  { id:'esquerda', x:[-0.125, 0.125], z:[0.125, 11.875], axis:'z', dir:-1,
    open:[{s:5.2,e:7.2,type:'win',sill:1.1,head:2.2},{s:9.0,e:11.0,type:'win',sill:1.0,head:2.2}] },
  { id:'int-h',    x:[0.125, 8.875], z:[4.125, 4.275], axis:'x', dir:+1,
    open:[{s:2.6,e:3.4,type:'door',head:2.1,swing:-1,hinge:'e'},{s:4.2,e:4.9,type:'door',head:2.1,swing:-1,hinge:'s'},{s:6.5,e:7.3,type:'door',head:2.1,swing:-1,hinge:'e'}] },
  { id:'int-v1',   x:[3.525, 3.675], z:[0.125, 4.125], axis:'z', dir:+1, open:[] },
  { id:'int-v2',   x:[5.525, 5.675], z:[0.125, 4.125], axis:'z', dir:+1, open:[] },
  { id:'int-v3',   x:[3.525, 3.675], z:[4.275, 6.4],   axis:'z', dir:+1, open:[] },
];
const rooms = [
  { name:'QUARTO 1', area:'15,12 m²', x:[0.125,3.525], z:[0.125,4.125], lx:1.8, lz:3.2, floor:'wood' },
  { name:'BANHO',    area:'8,40 m²',  x:[3.675,5.525], z:[0.125,4.125], lx:4.6, lz:3.25, floor:'tile' },
  { name:'QUARTO 2', area:'14,28 m²', x:[5.675,8.875], z:[0.125,4.125], lx:7.3, lz:3.2, floor:'wood' },
  { name:'COZINHA',  area:'',         x:[0.125,3.525], z:[4.275,11.875], lx:1.9, lz:8.6, floor:'tile', skipFloor:true },
  { name:'ESTAR / JANTAR', area:'40,92 m²', x:[3.675,8.875], z:[4.275,11.875], lx:6.3, lz:7.6, floor:'wood', skipFloor:true },
];
// piso único da área social (cozinha + estar), para não deixar fresta sob a parede parcial
const socialFloor = { x:[0.125,8.875], z:[4.275,11.875] };

const furniture = [
  { kind:'bed',   x:[0.55,2.15], z:[0.15,2.25], h:0.5, color:0xf3efe6 },
  { kind:'bed',   x:[6.45,8.05], z:[0.15,2.25], h:0.5, color:0xf3efe6 },
  { kind:'box',   x:[3.85,4.35], z:[0.2,0.85],  h:0.45, color:0xffffff },  // vaso
  { kind:'box',   x:[4.75,5.45], z:[0.15,0.7],  h:0.85, color:0xd9d4cc },  // bancada
  { kind:'box',   x:[0.125,0.75], z:[4.45,8.0], h:0.9, color:0x6f7378, top:0x2b2e31 }, // bancada cozinha
  { kind:'box',   x:[4.6,6.2],  z:[5.2,6.6],   h:0.75, color:0xb08158 },   // mesa jantar
  { kind:'sofa',  x:[5.4,6.25], z:[9.4,11.5],  h:0.45, color:0x7d8a99 },
  { kind:'box',   x:[6.75,7.5], z:[9.9,11.0],  h:0.4,  color:0xb08158 },   // mesa centro
  { kind:'box',   x:[8.45,8.875], z:[9.8,11.4], h:0.5, color:0x3a3d40 },   // rack
];

// ---------- RNG determinístico ----------
