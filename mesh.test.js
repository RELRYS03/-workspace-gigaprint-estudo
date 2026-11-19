import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bounds,scaleParts,importSTL,exportSTL} from './mesh.js';
import {cutPart,primitive} from './solid.js';

test('redimensiona um sólido e preserva a geometria ao exportar e importar STL',async()=>{
  const part=await primitive('cube');
  const scaled=scaleParts([part],[2,.5,1]);
  const imported=importSTL(exportSTL(scaled),'Redimensionada');
  assert.deepEqual(bounds(imported).size,[60,15,30]);
  assert.equal(imported[0].triangles.length,12);
});

test('corta nos dois lados e fecha as novas superfícies',async()=>{
  const part=await primitive('cube');
  const halves=await cutPart(part,2,12,'both');
  assert.deepEqual(halves.map(half=>bounds([half]).size),[[30,30,18],[30,30,12]]);
  for(const half of halves) {
    const edges=new Map();
    for(const triangle of half.triangles) for(let i=0;i<3;i++){
      const a=triangle[i], b=triangle[(i+1)%3], key=[Math.min(a,b),Math.max(a,b)].join(',');
      const directions=edges.get(key)??[];
      directions.push(Math.sign(b-a));
      edges.set(key,directions);
    }
    assert.ok([...edges.values()].every(directions=>directions.length===2&&directions[0]+directions[1]===0));
  }
  await assert.rejects(cutPart({...part,triangles:part.triangles.slice(1)},2,12,'both'),/malha fechada|NotManifold/i);
});
