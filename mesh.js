import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {unzipSync, strFromU8} from 'fflate';

export function bounds(parts) {
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for(const part of parts) for(const vertex of part.vertices) for(let axis=0;axis<3;axis++){
    min[axis]=Math.min(min[axis],vertex[axis]);
    max[axis]=Math.max(max[axis],vertex[axis]);
  }
  return {min,max,size:max.map((end,i)=>end-min[i])};
}

export function scaleParts(parts,factors) {
  const {min}=bounds(parts);
  return parts.map(part=>({...part,vertices:part.vertices.map(v=>v.map((value,i)=>min[i]+(value-min[i])*factors[i]))}));
}

export function importSTL(buffer,name) {
  const geometry=new STLLoader().parse(buffer);
  try {
    const position=geometry.getAttribute('position'), vertices=[], triangles=[], map=new Map();
    if(!position.count || position.count%3) throw new Error('O STL está vazio ou incompleto.');
    for(let i=0;i<position.count;i+=3){
      const triangle=[];
      for(let j=i;j<i+3;j++){
        const xyz=[position.getX(j),position.getY(j),position.getZ(j)];
        if(!xyz.every(Number.isFinite)) throw new Error('O STL contém coordenadas inválidas.');
        const key=xyz.join(',');
        if(!map.has(key)){map.set(key,vertices.length);vertices.push(xyz);}
        triangle.push(map.get(key));
      }
      if(new Set(triangle).size===3) triangles.push(triangle);
    }
    if(!triangles.length) throw new Error('O STL não contém triângulos válidos.');
    return [{name,color:'#a21432',vertices,triangles}];
  } finally {geometry.dispose();}
}

const children=(element,name)=>[...element.children].filter(child=>child.localName===name);
const child=(element,name)=>children(element,name)[0];
const identity=[1,0,0,0,1,0,0,0,1,0,0,0];
function transform(element){
  const raw=element.getAttribute('transform');
  const values=raw===null?identity:raw.trim().split(/\s+/).map(Number);
  if(values.length!==12||!values.every(Number.isFinite)) throw new Error('Transformação inválida no 3MF.');
  return values;
}
const apply=(m,v)=>[0,1,2].map(i=>v[0]*m[i]+v[1]*m[3+i]+v[2]*m[6+i]+m[9+i]);
const det=m=>m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);

export function import3MF(buffer) {
  const bytes=new Uint8Array(buffer);
  const files=unzipSync(bytes,{filter:file=>/\.model$|^_rels\/\.rels$/i.test(file.name)&&file.originalSize<=100_000_000});
  const parse=bytes=>{
    const doc=new DOMParser().parseFromString(strFromU8(bytes),'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('O XML do 3MF é inválido.');
    return doc.documentElement;
  };
  const relations=files['_rels/.rels'];
  const rootPath=(relations && children(parse(relations),'Relationship').find(node=>node.getAttribute('Type')?.endsWith('/3dmodel'))?.getAttribute('Target'))?.replace(/^\//,'') || '3D/3dmodel.model';
  const models=new Map();
  function load(path){
    if(models.has(path)) return models.get(path);
    const bytes=files[path];
    if(!bytes) throw new Error('Uma parte da geometria do 3MF está ausente.');
    const root=parse(bytes), resources=child(root,'resources');
    const unit={micron:.001,millimeter:1,centimeter:10,inch:25.4,foot:304.8,meter:1000}[root.getAttribute('unit')||'millimeter'];
    if(root.localName!=='model'||!resources||!unit) throw new Error('Modelo ou unidade 3MF inválida.');
    const objects=new Map(children(resources,'object').map(node=>[node.getAttribute('id'),node]));
    const materials=new Map(children(resources,'basematerials').map(node=>[node.getAttribute('id'),children(node,'base')]));
    const model={root,unit,objects,materials};
    models.set(path,model);
    return model;
  }
  const root=load(rootPath), build=child(root.root,'build');
  if(!build) throw new Error('O 3MF não contém uma mesa de impressão.');
  const parts=[];
  function collect(model,id,matrices,chain,mirrored){
    const obj=model.objects.get(id);
    if(!obj||chain.includes(obj)||chain.length>=64||parts.length>=512) throw new Error('Estrutura de componentes 3MF inválida ou grande demais.');
    const mesh=child(obj,'mesh'), components=child(obj,'components');
    if(components){
      for(const c of children(components,'component')){
        const path=[...c.attributes].find(a=>a.localName==='path')?.value?.replace(/^\//,'');
        const matrix=transform(c);
        collect(path?load(path):model,c.getAttribute('objectid'),[matrix,...matrices],[...chain,obj],mirrored!==(det(matrix)<0));
      }
      return;
    }
    if(!mesh||!child(mesh,'vertices')||!child(mesh,'triangles')) throw new Error('O objeto 3MF não contém uma malha de triângulos.');
    const vertices=children(child(mesh,'vertices'),'vertex').map(v=>matrices.reduce((point,m)=>apply(m,point),['x','y','z'].map(axis=>Number(v.getAttribute(axis)))).map(n=>n*root.unit));
    const triangles=children(child(mesh,'triangles'),'triangle').map(t=>(mirrored?['v1','v3','v2']:['v1','v2','v3']).map(key=>Number(t.getAttribute(key))));
    if(!vertices.length||!triangles.length||vertices.some(v=>!v.every(Number.isFinite))||triangles.some(t=>t.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))) throw new Error('Malha 3MF inválida.');
    const color=model.materials.get(obj.getAttribute('pid'))?.[Number(obj.getAttribute('pindex'))]?.getAttribute('displaycolor')?.slice(0,7);
    parts.push({name:obj.getAttribute('name')||`Peça ${parts.length+1}`,color:/^#[0-9a-f]{6}$/i.test(color)?color:'#a21432',vertices,triangles});
  }
  for(const item of children(build,'item')){
    const matrix=transform(item);
    collect(root,item.getAttribute('objectid'),[matrix],[],det(matrix)<0);
  }
  if(!parts.length) throw new Error('O 3MF não contém peças.');
  return parts;
}

export function exportSTL(parts) {
  const count=parts.reduce((n,part)=>n+part.triangles.length,0);
  const buffer=new ArrayBuffer(84+50*count), view=new DataView(buffer);
  view.setUint32(80,count,true);
  let offset=84;
  for(const part of parts) for(const triangle of part.triangles){
    const [a,b,c]=triangle.map(i=>part.vertices[i]);
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...normal)||1;
    for(const value of [...normal.map(n=>n/length),...a,...b,...c]){
      view.setFloat32(offset,value,true);offset+=4;
    }
    offset+=2;
  }
  return buffer;
}
