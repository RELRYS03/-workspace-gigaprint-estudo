import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ballPress,pressDimensions} from './press.js';
import {ballLattice} from './ball-lattice.js';
import {defaults} from './geometry.js';
import {solidModule} from './solid.js';

function solid({Mesh,Manifold},part){
  return new Manifold(new Mesh({numProp:3,vertProperties:new Float32Array(part.vertices.flat()),triVerts:new Uint32Array(part.triangles.flat())}));
}

test('a fêmea tem fundo e cavidade aberta; o macho fechado cabe nela',async()=>{
  const runtime=await solidModule();
  for(const size of [40,80,150]){
    const state={...defaults,size};
    const {floor,opening,depth,gap}=pressDimensions(state);
    const male=solid(runtime,ballPress(state,false));
    const femaleData=ballPress(state,true);
    const female=solid(runtime,femaleData);
    const rotated=male.rotate(180,0,0);
    const fitted=rotated.translate(0,0,opening+floor);
    const overlap=fitted.intersect(female);
    try{
      assert.ok(male.volume()>0&&female.volume()>0);
      const center=femaleData.vertices.filter(([x,y])=>x===0&&y===0);
      assert.deepEqual(center.map(([, , z])=>z),[0,floor]);
      assert.equal(opening-floor,depth+gap);
      assert.ok(Math.abs(overlap.volume())<.00001);
    }finally{for(const part of [overlap,fitted,rotated,female,male])part.delete();}
  }
});

test('as barras planas e o aro formam uma peça contínua com furos',async()=>{
  const runtime=await solidModule();
  for(const pattern of ['square','diamond','triangle']){
    const parts=await ballLattice({...defaults,pattern,join:'flat'},()=>false);
    assert.equal(parts.length,2);
    const part=solid(runtime,parts[0]);
    const components=part.decompose();
    try{
      assert.equal(components.length,1);
      assert.ok(part.genus()>0);
      assert.equal(part.boundingBox().min[2],0);
    }finally{for(const component of components)component.delete();part.delete();}
  }
});
