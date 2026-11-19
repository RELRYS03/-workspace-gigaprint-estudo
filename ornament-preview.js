// The canvas is a software viewport so the workbench also runs without WebGL.
export function drawOrnament(canvas, model, state, options) {
  const ctx=canvas.getContext('2d');
  const {width:w,height:h}=canvas;
  const {yaw,pitch,zoom,view,wire,ids,reference,bed}=options;
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const unit=Math.min(w/435,h/400)*zoom;
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
  const faces=[], labels=[];
  function cell(p0,p1,p2,p3,color){
    const points=[p0,p1,p2,p3].map(p=>project(...p));
    const [a,b,c]=points;
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(area)<.012) return;
    faces.push({points,depth:points.reduce((sum,p)=>sum+p[2],0)/4,color,shade:area>0?0.15:0.05});
  }
  function piece(kind,ox,oy,oz,label){
    labels.push([label,project(ox,oy,oz+8)]);
    const press=kind==='male'||kind==='female';
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
  if(view==='combo'){
    piece('back',-s*.64,0,s*.66,'2');piece('formed',-s*.64,0,s*.66,'1');
    piece('male',s*.49,0,5,'3');piece('flat',s*.49,0,dome+11,'4');piece('female',s*.49,0,dome*2+25,'5');
  }else if(view==='plate'){
    const gap=s*.57;
    piece('flat',-gap,-gap,0,'1');piece('flat',gap,-gap,0,'2');piece('male',-gap,gap,4,'3');piece('female',gap,gap,dome+4,'4');
  }else if(view==='ornament'){
    piece('back',0,0,s*.62,'2');piece('formed',0,0,s*.62,'1');
  }else if(view==='mold'){
    piece('male',-s*.61,0,5,'1');piece('female',s*.61,0,dome+5,'2');
  }else{
    piece(view,0,0,view==='flat'?0:s*.62,'1');
  }
  faces.sort((a,b)=>b.depth-a.depth);
  for(const {points,color,shade} of faces){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(const point of points.slice(1)) ctx.lineTo(point[0],point[1]);
    ctx.closePath();
    if(wire){ctx.strokeStyle=color;ctx.globalAlpha=.72;ctx.stroke();}
    else{
      ctx.fillStyle=color;ctx.fill();
      ctx.strokeStyle=color;ctx.lineWidth=.55;ctx.stroke();ctx.lineWidth=1;
      ctx.fillStyle=`rgba(12,23,43,${shade})`;ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  const quote=(text,x,y)=>{
    ctx.font=`700 ${Math.max(11,Math.min(16,w/75))}px system-ui`;
    ctx.fillStyle='#3159d1';ctx.fillText(text,x,y);
  };
  if(ids) for(const [label,[x,y]] of labels) quote(label,x+8,y-6);
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
