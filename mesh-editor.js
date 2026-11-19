import {bounds, scaleParts, importSTL, import3MF, exportSTL} from './mesh.js';
import {configureSolidRuntime, cutPart, primitive} from './solid.js';
import wasmURL from 'manifold-3d/manifold.wasm?url';
import {export3mf} from './export.js';

configureSolidRuntime(wasmURL);
const get=id=>document.getElementById(id);
const canvas=get('mesh-preview'), ctx=canvas.getContext('2d');
const message=get('mesh-message'), selection=get('mesh-selection'), edit=get('mesh-edit');
const scale=get('mesh-scale'), cut=get('mesh-cut'), fileInput=get('mesh-file');
const axes=['x','y','z'];
let parts=[], history=[], selected=-1, busy=false, yaw=-.56, pitch=.52, lastPoint=null;

function route(){
  const mesh=location.hash==='#mesh';
  get('mesh').hidden=!mesh;
  get('ornament').hidden=mesh;
  for(const link of document.querySelectorAll('.top a')){
    if(link.hash===(mesh?'#mesh':'#ornament')) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
addEventListener('hashchange',route);
route();

const affected=()=>selected===-1?parts:[parts[selected]];
function save(next,nextSelection=selected){
  history.push({parts,selected});
  if(history.length>12) history.shift();
  parts=next;
  selected=nextSelection;
}
function render(){
  const {width,height}=canvas;
  ctx.fillStyle='#eef1e9';ctx.fillRect(0,0,width,height);
  if(!parts.length){
    ctx.fillStyle='#536267';ctx.font='20px system-ui';ctx.textAlign='center';
    ctx.fillText('Crie ou importe um modelo',width/2,height/2);return;
  }
  const {min,max,size}=bounds(parts), center=min.map((v,i)=>(v+max[i])/2);
  const zoom=Math.min(width,height)*.68/(Math.hypot(...size)||1);
  const [cy,sy,cp,sp]=[Math.cos(yaw),Math.sin(yaw),Math.cos(pitch),Math.sin(pitch)];
  const faces=[];
  const stride=Math.ceil(parts.reduce((count,part)=>count+part.triangles.length,0)/22000);
  for(const [index,part] of parts.entries()){
    const projected=part.vertices.map(([vx,vy,vz])=>{
      const [x,y,z]=[vx-center[0],vy-center[1],vz-center[2]];
      const along=sy*x+cy*y;
      return [width/2+zoom*(cy*x-sy*y),height/2-zoom*(sp*along+cp*z),cp*along-sp*z];
    });
    for(let i=0;i<part.triangles.length;i+=stride){
      const [a,b,c]=part.triangles[i].map(v=>projected[v]);
      const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if(Math.abs(area)<.01) continue;
      faces.push({a,b,c,depth:(a[2]+b[2]+c[2])/3,color:part.color,opacity:selected===-1||selected===index?(area<0?.9:.6):.28});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const {a,b,c,color,opacity} of faces){
    ctx.globalAlpha=opacity;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.fill();
  }
  ctx.globalAlpha=1;
}

function sync(){
  const has=parts.length>0;
  selection.replaceChildren(new Option('Todas as peças','-1'),...parts.map((part,i)=>new Option(part.name,String(i))));
  selection.value=String(selected);
  edit.disabled=busy||!has;
  get('mesh-copy').disabled=selected===-1;
  get('mesh-undo').disabled=busy||!history.length;
  get('mesh-stl').disabled=get('mesh-3mf').disabled=busy||!has;
  fileInput.disabled=busy;
  for(const button of document.querySelectorAll('[data-primitive]')) button.disabled=busy;
  const size=has?bounds(affected()).size:[0,0,0];
  get('mesh-info').textContent=has?`${parts.length} peças · ${size.map(x=>x.toFixed(1)).join(' × ')} mm`:'Nenhuma peça';
  axes.forEach((name,i)=>{scale.elements[name].value=has?String(Number(size[i].toFixed(4))):'';});
  syncUniform();
  render();
}
function syncUniform(){
  for(const axis of ['y','z']) scale.elements[axis].disabled=scale.elements.uniform.checked;
}
async function run(label,operation){
  if(busy) return;
  busy=true;message.textContent=label;sync();
  try{message.textContent=await operation();}
  catch(error){message.textContent=error instanceof Error?error.message:'Não foi possível concluir a operação.';}
  finally{busy=false;sync();}
}
for(const button of document.querySelectorAll('[data-primitive]')) button.addEventListener('click',()=>{
  run('Criando peça…',async()=>{
    const shape=await primitive(button.dataset.primitive);
    save([...parts,shape],parts.length);
    return `${shape.name} criado.`;
  });
});
fileInput.addEventListener('change',()=>{
  const file=fileInput.files[0];fileInput.value='';
  if(!file) return;
  run('Importando modelo…',async()=>{
    if(file.size>100_000_000) throw new Error('O arquivo excede o limite de 100 MB.');
    const extension=file.name.split('.').pop().toLowerCase(), data=await file.arrayBuffer();
    if(extension!=='stl'&&extension!=='3mf') throw new Error('Selecione um arquivo STL ou 3MF.');
    const imported=extension==='stl'?importSTL(data,file.name.replace(/\.stl$/i,'')):import3MF(data);
    save(imported,-1);
    return `${imported.length} peça(s) importada(s). Use Desfazer para voltar à cena anterior.`;
  });
});
selection.addEventListener('change',()=>{selected=Number(selection.value);sync();});
scale.elements.uniform.addEventListener('change',syncUniform);
scale.addEventListener('submit',event=>{
  event.preventDefault();
  const targets=affected(), {size}=bounds(targets);
  const uniform=scale.elements.uniform.checked;
  const factors=axes.map((axis,i)=>uniform?scale.elements.x.valueAsNumber/size[0]:scale.elements[axis].valueAsNumber/size[i]);
  if(!factors.every(n=>Number.isFinite(n)&&n>0)){
    message.textContent='Escolha dimensões positivas. Uma dimensão original igual a zero não pode ser redimensionada.';return;
  }
  const resized=scaleParts(targets,factors);
  save(selected===-1?resized:parts.map((part,i)=>i===selected?resized[0]:part));
  message.textContent='Dimensões aplicadas.';sync();
});
cut.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(cut);
  run('Cortando malha…',async()=>{
    const source=affected(), axis=Number(data.get('axis')), position=Number(data.get('position'))/100;
    const {min,size}=bounds(source), offset=min[axis]+size[axis]*position, mode=data.get('mode');
    if(!(size[axis]>0)) throw new Error('A peça não tem espessura nesse eixo.');
    const result=[];
    for(const part of source){
      const {min,max}=bounds([part]);
      if(max[axis]<=offset || min[axis]>=offset){
        if(mode==='both'||(mode==='positive'?min[axis]>=offset:max[axis]<=offset)) result.push(part);
        continue;
      }
      result.push(...await cutPart(part,axis,offset,mode));
    }
    if(!result.length) throw new Error('O corte deixaria a seleção vazia.');
    if(result.length===source.length&&result.every((part,i)=>part===source[i])) throw new Error('O plano passa entre as peças. Ajuste a posição.');
    save(selected===-1?result:[...parts.slice(0,selected),...result,...parts.slice(selected+1)],-1);
    return 'Corte aplicado à geometria.';
  });
});
get('mesh-copy').addEventListener('click',()=>{
  const source=parts[selected], {size}=bounds([source]);
  const copy={...source,name:`${source.name} (cópia)`,vertices:source.vertices.map(([x,y,z])=>[x+size[0]+5,y,z])};
  save([...parts,copy],parts.length);sync();message.textContent='Cópia criada.';
});
get('mesh-undo').addEventListener('click',()=>{
  const previous=history.pop();if(!previous) return;
  ({parts,selected}=previous);message.textContent='Alteração desfeita.';sync();
});
function download(format){
  run('Preparando arquivo…',async()=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const bytes=format==='stl'?exportSTL(affected()):export3mf(affected());
    const url=URL.createObjectURL(new Blob([bytes]));
    const link=document.createElement('a');link.href=url;link.download=`modelo-editado.${format}`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return `${format.toUpperCase()} gerado.`;
  });
}
get('mesh-stl').addEventListener('click',()=>download('stl'));
get('mesh-3mf').addEventListener('click',()=>download('3mf'));
addEventListener('ornament-mesh',event=>{
  save(event.detail.map(({x,y,...part})=>({...part,vertices:part.vertices.map(([vx,vy,vz])=>[vx+x,vy+y,vz])})),-1);
  location.hash='mesh';message.textContent='Peças do enfeite carregadas.';sync();
});
canvas.addEventListener('pointerdown',event=>{lastPoint=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{
  if(!lastPoint)return;
  yaw+=(event.clientX-lastPoint[0])*.01;
  pitch=Math.max(-1.5,Math.min(1.5,pitch+(event.clientY-lastPoint[1])*.01));
  lastPoint=[event.clientX,event.clientY];render();
});
for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,()=>{lastPoint=null;});
sync();
