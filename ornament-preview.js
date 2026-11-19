import {ballPress,pressDimensions} from './press.js';

let moldKey, molds;
// The canvas is a software viewport so the workbench also runs without WebGL.
export function drawOrnament(canvas, model, state, options) {
  const ctx=canvas.getContext('2d');
  const {width:w,height:h}=canvas;
  const {yaw,pitch,zoom,view,wire,ids,reference,bed}=options;
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const unit=Math.min(w/435,h/400)*zoom*(view==='mold'?1.35:1);
  const origin=[w*.49,h*.63];
  function project(x,y,z){
    const horizontal=cy*x-sy*y, depth=sy*x+cy*y;
    return [origin[0]+horizontal*unit,origin[1]+(depth*sp-z*cp)*unit,depth*cp+z*sp];
  }
  ctx.fillStyle='#f3f6fc';ctx.fillRect(0,0,w,h);
  const [bedX,bedY]=bed;
  const spanX=view==='plate'?bedX/2:Math.max(170,bedX*.86);
  const spanY=view==='plate'?bedY/2:Math.max(170,bedY*.83);
  const line=(a,b)=>{
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  };
  ctx.strokeStyle='#ccdaf4';
  const gridStep=Math.max(10,Math.ceil(Math.max(spanX,spanY)/240)*10);
  for(let x=Math.ceil(-spanX/gridStep)*gridStep;x<=spanX;x+=gridStep) line(project(x,-spanY,0),project(x,spanY,0));
  for(let y=Math.ceil(-spanY/gridStep)*gridStep;y<=spanY;y+=gridStep) line(project(-spanX,y,0),project(spanX,y,0));
  if(view==='plate'){
    const outline=[project(-spanX,-spanY,0),project(spanX,-spanY,0),project(spanX,spanY,0),project(-spanX,spanY,0)];
    ctx.strokeStyle='#6686d4';
    outline.forEach((point,i)=>line(point,outline[(i+1)%4]));
  }
  if(!model) return;
  const {n,body,flat,heights,step}=model;
  const faces=[], labels=[], shades=new Map();
  function cell(p0,p1,p2,p3,color){
    const points=[p0,p1,p2,p3].map(p=>project(...p));
    const [a,b,c]=points;
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(area)<.012) return;
    faces.push({points,depth:points.reduce((sum,p)=>sum+p[2],0)/4,color,shade:area>0?0.15:0.05});
  }
  function piece(kind,ox,oy,oz,label){
    const caption=view==='mold'?(kind==='female'?'Fêmea · cavidade':'Macho · ressalto'):label;
    labels.push([caption,project(ox,oy,oz+(view==='mold'?state.size*.57:8))]);
    const press=kind==='male'||kind==='female'||kind==='male-flipped';
    if(press&&state.shape==='ball'){
      const key=[state.size,state.depth,state.thickness,state.clearance,state.mode].join('/');
      if(key!==moldKey){moldKey=key;molds=[ballPress(state,false),ballPress(state,true)];}
      const mesh=molds[Number(kind==='female')];
      const flip=kind==='male-flipped';
      const pos=mesh.vertices.map(([x,y,z])=>[ox+x,oy+(flip?-y:y),oz+(flip?-z:z)]);
      for(const triangle of mesh.triangles){
        const [a,b,c]=triangle.map(i=>pos[i]);
        const u=b.map((value,i)=>value-a[i]),v=c.map((value,i)=>value-a[i]);
        const nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];
        const shade=.30-.23*Math.max(0,(-.32*nx-.43*ny+.84*nz)/(Math.hypot(nx,ny,nz)||1));
        const points=[a,b,c].map(point=>project(...point));
        const [p,q,r]=points;
        if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])>=0) continue;
        faces.push({points,depth:points.reduce((sum,p)=>sum+p[2],0)/3,color:state.mold,shade});
      }
      return;
    }
    const rigid=press||kind==='flat';
    const sign=kind==='back'||kind==='female'?-1:1;
    for(let row=0;row<n;row++) for(let col=0;col<n;col++){
      const i=row*n+col,x=(col-n/2)*step,y=(row-n/2)*step;
      const type=(kind==='flat'?flat:body)[i];
      if(press){
        if(Math.hypot(x+step/2,y+step/2)>state.size*.54) continue;
      } else if(!type) continue;
      const color=press?state.mold:type===2&&(kind!=='back'||state.back!=='plain')?state.design:state.lattice;
      const height=(dx,dy)=>{
        if(kind==='flat') return state.thickness;
        const column=Math.min(n-1,col+dx), line=Math.min(n-1,row+dy);
        const curve=heights[line*n+column];
        return press?sign*curve*.78:sign*curve;
      };
      const corner=(dx,dy)=>{
        const px=ox+x+dx*step, py=y+dy*step, z=height(dx,dy);
        return rigid?[px,oy+py,oz+z]:[px,oy+z,oz-py];
      };
      const a=corner(0,0),b=corner(1,0),c=corner(1,1),d=corner(0,1);
      cell(a,b,c,d,color);
      if(press&&Math.hypot(x,y)>state.size*.54-2*step){
        const lower=v=>[v[0],v[1],v[2]-4];
        cell(a,b,lower(b),lower(a),color);
        cell(b,c,lower(c),lower(b),color);
      }
    }
  }
  const s=state.size, dome=s*state.depth/200;
  const opening=state.shape==='ball'?pressDimensions(state).opening:dome+5;
  if(view==='combo'){
    piece('back',-s*.64,0,s*.66,'2');piece('formed',-s*.64,0,s*.66,'1');
    piece('female',s*.54,0,0,'3');piece('flat',s*.54,0,opening+9,'4');piece(state.shape==='ball'?'male-flipped':'male',s*.54,0,opening+dome+25,'5');
  }else if(view==='plate'){
    const gap=s*.57;
    piece('flat',-gap,-gap,0,'1');piece('flat',gap,-gap,0,'2');piece('male',-gap,gap,4,'3');piece('female',gap,gap,0,'4');
  }else if(view==='ornament'){
    piece('back',0,0,s*.62,'2');piece('formed',0,0,s*.62,'1');
  }else if(view==='mold'){
    piece('male',-s*.61,0,5,'1');piece('female',s*.61,0,0,'2');
  }else{
    piece(view,0,0,view==='flat'?0:s*.62,'1');
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const {points,color,shade} of faces){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(const point of points.slice(1)) ctx.lineTo(point[0],point[1]);
    ctx.closePath();
    if(wire){ctx.strokeStyle=color;ctx.globalAlpha=.72;ctx.stroke();}
    else{
      const light=Math.round(shade*36), key=color+light;
      if(!shades.has(key)){
        const rgb=[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*(1-light/36)));
        shades.set(key,`rgb(${rgb.join(',')})`);
      }
      ctx.fillStyle=ctx.strokeStyle=shades.get(key);
      ctx.fill();ctx.lineWidth=.55;ctx.stroke();ctx.lineWidth=1;
    }
    ctx.globalAlpha=1;
  }
  const quote=(text,x,y)=>{
    ctx.font=`700 ${Math.max(11,Math.min(16,w/75))}px system-ui`;
    ctx.fillStyle='#3159d1';ctx.fillText(text,x,y);
  };
  if(ids||view==='mold') for(const [label,[x,y]] of labels){
    ctx.textAlign=view==='mold'?'center':'left';
    quote(label,x+(view==='mold'?0:8),y-6);
  }
  ctx.textAlign='left';
  if(reference&&view!=='plate'){
    const [x,y]=project(s*1.35,0,0), pixels=s*unit;
    if(x>12&&x<w-100){
      const top=Math.max(h*.17,y-pixels);
      ctx.strokeStyle='#a38145';line([x,y],[x,top]);
      for(let i=0;i<=8;i++){const tick=y-(y-top)*i/8;line([x,tick],[x+(i%2?5:9),tick]);}
      quote(`${s} mm`,x+13,top+12);
    }
  }
}
