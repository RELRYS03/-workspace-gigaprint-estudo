import factory from 'manifold-3d/manifold';
let runtime;
let wasmURL;
export function configureSolidRuntime(url){wasmURL=url;}
export async function solidModule() {
  runtime??=factory(wasmURL?{locateFile:()=>wasmURL}:undefined).then(instance=>{instance.setup();return instance;});
  return runtime;
}
export function readSolid(solid,source){
  const mesh=solid.getMesh(), vertices=[], triangles=[];
  for(let i=0;i<mesh.vertProperties.length;i+=mesh.numProp) vertices.push(Array.from(mesh.vertProperties.subarray(i,i+3)));
  for(let i=0;i<mesh.triVerts.length;i+=3) triangles.push(Array.from(mesh.triVerts.subarray(i,i+3)));
  return {...source,vertices,triangles};
}
export async function primitive(kind){
  const {Manifold}=await solidModule();
  const solid=kind==='sphere'?Manifold.sphere(15,32):kind==='cylinder'?Manifold.cylinder(30,15,15,32):Manifold.cube([30,30,30]);
  try{return readSolid(solid,{name:{sphere:'Esfera',cylinder:'Cilindro',cube:'Cubo'}[kind],color:'#a21432'});}
  finally{solid.delete();}
}
export async function cutPart(part,axis,offset,mode){
  const {Manifold,Mesh}=await solidModule();
  const mesh=new Mesh({numProp:3,vertProperties:new Float32Array(part.vertices.flat()),triVerts:new Uint32Array(part.triangles.flat())});
  mesh.merge();
  let solid;
  try{solid=new Manifold(mesh);}
  catch(error){
    if(error.code!=='NotManifold') throw error;
    throw new Error('O corte exige uma malha fechada e com faces orientadas.');
  }
  const results=[];
  try{
    if(solid.status()!=='NoError') throw new Error('O corte exige uma malha fechada e com faces orientadas.');
    const normal=[0,0,0];
    normal[axis]=mode==='negative'?-1:1;
    if(mode==='both') results.push(...solid.splitByPlane(normal,offset));
    else results.push(solid.trimByPlane(normal,normal[axis]*offset));
    const pieces=results.filter(result=>!result.isEmpty()).map((result,i)=>readSolid(result,{
      name:mode==='both'?`${part.name} — lado ${i+1}`:part.name,color:part.color
    }));
    if(!pieces.length) throw new Error('O corte deixaria a peça vazia.');
    return pieces;
  } finally {
    for(const result of results) result.delete();
    solid.delete();
  }
}
