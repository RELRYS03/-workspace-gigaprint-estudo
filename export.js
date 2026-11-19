import { strToU8, zipSync } from 'fflate';

// Emit only the outer faces of each material. An integer grid gives neighboring
// cells exactly the same vertex coordinates, including at shared borders.
export function voxelMesh(n, nz, step, layer, sample) {
  const vertices=[], triangles=[], ids=new Map();
  const directions=[
    [-1,0,0,[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],
    [1,0,0,[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
    [0,-1,0,[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
    [0,1,0,[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],
    [0,0,-1,[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]],
    [0,0,1,[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],
  ];
  function vertex(x,y,z) {
    const key=(z*(n+1)+y)*(n+1)+x;
    if(!ids.has(key)){ids.set(key,vertices.length);vertices.push([x*step,y*step,z*layer]);}
    return ids.get(key);
  }
  for(let z=0;z<nz;z++) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    if(!sample(x,y,z)) continue;
    for(const [dx,dy,dz,corners] of directions) {
      if(sample(x+dx,y+dy,z+dz)) continue;
      const [a,b,c,d]=corners.map(([cx,cy,cz])=>vertex(x+cx,y+cy,z+cz));
      triangles.push([a,b,c],[a,c,d]);
    }
  }
  return {vertices,triangles};
}
export function printableParts(model,s) {
  const {n,step,body,flat,heights,holes}=model, layer=.4, mz=Math.ceil((s.size*.5*s.depth/100+7)/layer);
  const stock=(x,y,z)=>x>=0&&x<n&&y>=0&&y<n&&z>=0;
  const sample=(side,design)=>(x,y,z)=>{
    if(!stock(x,y,z)) return false;
    const i=y*n+x, type=flat[i], motif=body[i]===2&&(side===0||s.back==='same'), inlay=s.mode==='inlay';
    const isPin=s.join==='pins'&&type===4;
    if(side===1&&holes[i]) return false;
    if(design) return motif&&(inlay?z<Math.ceil(s.thickness/layer):z===Math.ceil(s.thickness/layer));
    if(isPin && side===0) return z<Math.ceil(3.6/layer);
    const layers=type===3||isPin?Math.ceil((2.4+(isPin?1.2:0))/layer):Math.ceil(s.thickness/layer);
    return Boolean(type)&&!(motif&&inlay)&&z<layers;
  };
  const press=(female)=>(x,y,z)=>{
    if(!stock(x,y,z)) return false;
    const r=Math.hypot((x+.5-n/2)*step,(y+.5-n/2)*step), margin=s.size*.54;
    if(r>margin) return false;
    const h=heights[y*n+x], base=3;
    if(!female) return z*layer<base+h;
    const cap=s.size*.5*s.depth/100+base;
    return z*layer<cap+3 && z*layer>=Math.max(0,h+base+s.clearance);
  };
  return [
    ['Malha da frente',s.lattice,0,0,sample(0,false)],['Desenho da frente',s.design,0,0,sample(0,true)],
    ['Malha do verso',s.lattice,1,0,sample(1,false)],['Desenho do verso',s.design,1,0,sample(1,true)],
    ['Molde macho',s.mold,0,1,press(false)],['Molde fêmea',s.mold,1,1,press(true)]
  ].map(([name,color,x,y,test])=>({name,color,x:x*n*step,y:y*n*step,...voxelMesh(n,mz,step,layer,test)})).filter(p=>p.triangles.length);
}
const escapeXml=value=>value.replace(/[&<>"']/g, character=>({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'
}[character]));
export function export3mf(parts) {
  const object=(p,i)=>`<object id="${i+2}" name="${escapeXml(p.name)}" type="model" pid="1" pindex="${i}"><mesh><vertices>${p.vertices.map(([x,y,z])=>`<vertex x="${x.toFixed(4)}" y="${y.toFixed(4)}" z="${z.toFixed(4)}"/>`).join('')}</vertices><triangles>${p.triangles.map(([a,b,c])=>`<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object>`;
  return zipSync(Object.fromEntries(Object.entries({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    '3D/3dmodel.model':`<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><basematerials id="1">${parts.map(p=>`<base name="${escapeXml(p.name)}" displaycolor="${p.color.toUpperCase()}FF"/>`).join('')}</basematerials>${parts.map(object).join('')}</resources><build>${parts.map((p,i)=>`<item objectid="${i+2}" transform="1 0 0 0 1 0 0 0 1 ${(p.x ?? 0).toFixed(4)} ${(p.y ?? 0).toFixed(4)} 0"/>`).join('')}</build></model>`
  }).map(([path,value])=>[path,strToU8(value)])),{level:4});
}
