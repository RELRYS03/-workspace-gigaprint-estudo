import './style.css';
import {defaults, shapes, makeModel, contains, validate} from './geometry.js';

const form=document.querySelector('#editor'), canvas=document.querySelector('#preview'), notice=document.querySelector('#notice');
const context=canvas.getContext('2d'), download=document.querySelector('#download');
const d=defaults;
const options=(name,items,selected,css='')=>`<div class="segments ${css}" role="group" aria-label="${name}">${Object.entries(items).map(([id,label])=>`<label><input type="radio" name="${name}" value="${id}" ${id===selected?'checked':''}>${label}</label>`).join('')}</div>`;
const section=(num,title,html)=>`<fieldset aria-labelledby="heading-${num}"><h2 id="heading-${num}"><span>0${num}</span>${title}</h2>${html}</fieldset>`;
const detail=(title,html)=>`<details><summary>${title}</summary>${html}</details>`;
const number=(key,label,min,max,step)=>`<label class="field">${label}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${d[key]}"></label>`;
const range=(key,label,min,max,step)=>`<label class="field range">${label}<input name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}"><output data-out="${key}"></output></label>`;
const check=(key,label)=>`<label class="check"><input type="checkbox" name="${key}" checked> ${label}</label>`;
const textField=(key,label,max,placeholder='')=>`<label class="field">${label}<input name="${key}" maxlength="${max}" value="${d[key]}" placeholder="${placeholder}"></label>`;
const views={combo:'Enfeite + molde',flat:'Impressão plana',mold:'Molde',formed:'Metade moldada',ornament:'Enfeite'};
document.querySelector('#views').innerHTML=options('view',views,'combo');
form.innerHTML=[
  section(1,'Forma do enfeite',options('shape',shapes,d.shape,'shapes')+
    '<div class="stack">'+options('preset',{'60':'Mini · 60 mm','80':'Médio · 80 mm','100':'Grande · 100 mm',custom:'Personalizado'},'80')+'</div>'+
    '<div id="custom" hidden>'+number('size','Tamanho (mm)',40,150,1)+'</div>'+
    detail('Profundidade do molde',range('depth','Profundidade',30,100,5))),
  section(2,'Malha',options('pattern',{square:'Quadrada',diamond:'Losangos',triangle:'Triangular'},d.pattern)+
    detail('Dimensões da malha','<div class="grid">'+number('thickness','Espessura (mm)',.6,2,.1)+number('line','Linha (mm)',.8,3,.1)+number('gap','Furo (mm)',2,12,.5)+'</div>')),
  section(3,'Desenho',options('motif',{snowflake:'Floco de neve',star:'Estrela',tree:'Árvore',stripes:'Listras',text:'Texto',image:'Imagem',none:'Sem desenho'},d.motif)+
    '<div id="custom-text" hidden>'+textField('text','Seu texto',40)+'<p class="tip">Use / para separar duas linhas.</p></div>'+
    '<div id="custom-image" hidden><label class="field">Enviar imagem<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>'+range('threshold','Limiar',10,245,5)+'</div>'+
    textField('name','Nome ou data (opcional)',24,'Ex.: Emma 2026')+
    '<div class="stack">'+options('font',{round:'Redonda',chunky:'Forte',soft:'Suave'},d.font)+'</div>'+
    range('designSize','Tamanho do desenho',30,95,5)+detail('Como o desenho é impresso',
    options('mode',{inlay:'Embutido na malha',raised:'Elevado sobre a malha'},d.mode)+check('pre','Pré-distorcer para a curva')+
    '<div class="stack">'+options('back',{same:'Desenho nos dois lados',plain:'Verso neutro'},d.back)+'</div>')),
  section(4,'Cores','<div class="grid">'+Object.entries({lattice:'Malha',design:'Desenho',mold:'Molde'}).map(([key,label])=>`<label class="field">${label}<input type="color" name="${key}" value="${d[key]}"></label>`).join('')+'</div>'),
  section(5,'Molde e montagem',detail('Folga e encaixe','<div class="grid">'+number('clearance','Folga (mm)',0,1,.05)+
    '<label class="field">Encaixe<select name="join"><option value="pins">Pinos e furos</option><option value="flat">Bordas planas</option></select></label></div>')+
    check('hanger','Alça no topo'))
].join('');

let image=null, imageError='', model, state=d, motifMask, view='combo', queued=false, working=false;
function readState() {
  const data=new FormData(form), next={...d,...Object.fromEntries(data)};
  for(const key of ['size','depth','thickness','line','gap','designSize','threshold','clearance']) {
    const value=data.get(key);
    next[key]=value===''?NaN:Number(value);
  }
  if(data.get('preset')!=='custom') next.size=Number(data.get('preset'));
  for(const key of ['pre','hanger']) next[key]=data.has(key);
  return next;
}
function buildMotif(s) {
  const side=256, mask=document.createElement('canvas');
  mask.width=mask.height=side;
  const ctx=mask.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.fillRect(0,0,side,side);
  const half=side/2, radius=half*s.designSize/100*.85;
  ctx.translate(half,half);
  if(s.motif==='image'&&image) {
    const scale=2*radius/Math.max(image.width,image.height);
    ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);
    const pixels=ctx.getImageData(0,0,side,side);
    for(let i=0;i<pixels.data.length;i+=4) {
      const shade=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
      pixels.data.fill(shade<s.threshold?0:255,i,i+3);
    }
    ctx.putImageData(pixels,0,0);
  }
  ctx.fillStyle=ctx.strokeStyle='black';
  if(s.motif==='snowflake') {
    ctx.lineWidth=Math.max(2,radius*.09);ctx.lineCap='round';
    for(let i=0;i<6;i++) {
      ctx.rotate(Math.PI/3);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-radius);
      for(const direction of [-1,1]) {
        ctx.moveTo(0,-radius*.64);ctx.lineTo(direction*radius*.23,-radius*.86);
      }
      ctx.stroke();
    }
  }
  function label(text,y,maxWidth) {
    ctx.font=`${s.font==='chunky'?900:700} ${radius*.43}px ${s.font==='soft'?'serif':'system-ui'}`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,y,maxWidth);
  }
  if(s.motif==='text') s.text.split('/',2).forEach((line,i,all)=>label(line,(i-(all.length-1)/2)*radius*.5,radius*2));
  if(s.name.trim()) label(s.name,radius*.95,radius*1.65);
  const pixels=ctx.getImageData(0,0,side,side).data;
  return (x,y)=>{
    const px=Math.floor(x*half+half),py=Math.floor(y*half+half);
    if(px<0||py<0||px>=side||py>=side) return false;
    if(['star','tree'].includes(s.motif)&&contains(s.motif,x*half/radius,y*half/radius)) return true;
    if(s.motif==='stripes'&&Math.abs(x)<.87&&Math.abs(y)<.87&&Math.sin((x+y)*28)>.48) return true;
    return pixels[(py*side+px)*4]<128;
  };
}

let yaw=-.25, drag=null;
function draw() {
  const {width:w,height:h}=canvas, c=context;
  c.clearRect(0,0,w,h);
  const backdrop=c.createLinearGradient(0,0,0,h);
  backdrop.addColorStop(0,'#f1f3ec');backdrop.addColorStop(1,'#e2e8dd');
  c.fillStyle=backdrop;c.fillRect(0,0,w,h);
  c.strokeStyle='#d5ddd2';c.lineWidth=1;
  for(let i=-h;i<w+h;i+=43) {
    c.beginPath();c.moveTo(i,h);c.lineTo(w/2+(i-w/2)*.5,h*.45);c.stroke();
  }
  for(let y=h*.46;y<h;y+=37) {c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  if(!model) return;
  const {n,body,flat,heights}=model;
  function piece(cx,cy,r,kind) {
    const points=[];
    const scale=2.32*r/n, angle=kind==='flat'?0:yaw;
    for(let row=0;row<n;row++) for(let col=0;col<n;col++) {
      const i=row*n+col, x=(col+.5-n/2)*scale, y=(row+.5-n/2)*scale;
      let type=kind==='flat'?flat[i]:body[i];
      if(kind==='press') type=Math.hypot(x,y)<1.05*r?5:0;
      if(kind==='back'&&state.back==='plain'&&type===2) type=1;
      if(!type) continue;
      const z=kind==='flat'?0:heights[i]*r/(state.size/2)*(kind==='back'?-.7:1);
      const px=Math.cos(angle)*x+Math.sin(angle)*z;
      const pz=-Math.sin(angle)*x+Math.cos(angle)*z;
      points.push([cx+px,cy+y*.88-pz*.46,pz+y*.12,type]);
    }
    points.sort((a,b)=>a[2]-b[2]);
    const colors=['',state.lattice,state.design,state.lattice,state.lattice,state.mold];
    for(const [x,y,z,type] of points) {
      c.globalAlpha=.78+Math.max(0,Math.min(.22,z/r*.6));
      c.fillStyle=colors[type];c.fillRect(x,y,scale+1,scale+1);
    }
    c.globalAlpha=1;
  }
  if(view==='combo') {
    piece(w*.68,h*.60,w*.21,'press');piece(w*.36,h*.45,w*.27,'formed');
  } else if(view==='ornament') {
    piece(w*.53,h*.54,w*.30,'back');piece(w*.49,h*.49,w*.29,'formed');
  } else {
    piece(w*.5,h*.51,w*.31,view==='mold'?'press':view);
  }
}
function update() {
  queued=false;
  const next=readState();
  document.querySelector('#custom').hidden=next.preset!=='custom';
  document.querySelector('#custom-text').hidden=next.motif!=='text';
  document.querySelector('#custom-image').hidden=next.motif!=='image';
  for(const output of form.querySelectorAll('[data-out]')) output.value=next[output.dataset.out]+(output.dataset.out==='threshold'?'':'%');
  const invalid=validate(next)||(next.motif==='image'&&!image?(imageError||'Selecione uma imagem para gerar o desenho.'):'');
  download.disabled=Boolean(invalid)||working;
  if(!working) notice.textContent=invalid;
  document.querySelector('#dimensions').textContent=Number.isFinite(next.size)?`${next.size} mm`:'';
  if(invalid) { model=null;draw();return; }
  state=next;motifMask=buildMotif(state);model=makeModel(state,motifMask,110);draw();
}
function schedule() {if(!queued){queued=true;requestAnimationFrame(update);}}
form.addEventListener('input',schedule);
form.addEventListener('submit',event=>event.preventDefault());
form.elements.image.addEventListener('change',async event=>{
  const file=event.target.files[0]; image=null; imageError='';schedule();
  if(!file) return;
  const url=URL.createObjectURL(file);
  try {
    const opened=new Image();opened.src=url;await opened.decode();
    if(event.target.files[0]===file) image=opened;
  } catch {if(event.target.files[0]===file) imageError='Não foi possível abrir a imagem.';}
  finally {URL.revokeObjectURL(url);schedule();}
});
document.querySelector('#views').addEventListener('change',event=>{view=event.target.value;draw();});
canvas.addEventListener('pointerdown',event=>{drag=event.clientX;canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{
  if(drag===null) return;
  yaw+=(event.clientX-drag)*.009;drag=event.clientX;draw();
});
for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{drag=null;});
download.addEventListener('click',()=>{
  if(!model||working) return;
  working=true;download.disabled=true;notice.textContent='Gerando o arquivo 3MF…';
  const current=state, motif=motifMask;
  const raster=new Uint8Array(256**2);
  for(let y=0;y<256;y++) for(let x=0;x<256;x++) raster[y*256+x]=Number(motif((x+.5)/128-1,(y+.5)/128-1));
  const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  function finish(message) {worker.terminate();working=false;update();notice.textContent=message;}
  worker.onmessage=({data})=>{
    if(data.error) {finish('Falha ao gerar o arquivo 3MF.');return;}
    const url=URL.createObjectURL(new Blob([data.bytes],{type:'model/3mf'}));
    const link=document.createElement('a');link.href=url;link.download=`enfeite-${current.shape}-${current.size}mm.3mf`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);finish('Arquivo 3MF gerado.');
  };
  worker.onerror=()=>finish('Falha ao iniciar o exportador.');
  worker.postMessage({state:current,raster},[raster.buffer]);
});
update();
