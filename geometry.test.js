import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {defaults, shapes, makeModel, validate} from './geometry.js';
import {printableParts, export3mf, voxelMesh} from './export.js';

test('parâmetros inválidos e vazios são rejeitados',()=>{
  assert.equal(validate(defaults),'');
  assert.match(validate({...defaults,size:151}),/40 e 150/);
  assert.match(validate({...defaults,thickness:NaN}),/Espessura/);
});
test('cada forma produz geometria, com silhuetas distintas',()=>{
  const signatures=Object.keys(shapes).map(shape=>{
    const model=makeModel({...defaults,shape},()=>false,110);
    assert.ok(model.body.includes(1));
    assert.ok(model.body.includes(3));
    return JSON.stringify(model.body);
  });
  assert.equal(new Set(signatures).size,Object.keys(shapes).length);
});
test('células adjacentes não deixam faces internas',()=>{
  const mesh=voxelMesh(2,1,1,1,(x,y,z)=>x>=0&&x<2&&y===0&&z===0);
  assert.equal(mesh.vertices.length,12);
  assert.equal(mesh.triangles.length,20);
});
test('3MF contém duas metades, dois moldes e desenho colorido',()=>{
  const state={...defaults,back:'plain'};
  const parts=printableParts(makeModel(state,(x,y)=>Math.hypot(x,y)<.2,55),state);
  assert.equal(parts.length,5);
  assert.ok(parts.every(p=>p.triangles.length>0));
  const files=unzipSync(export3mf(parts));
  assert.deepEqual(Object.keys(files).sort(),['3D/3dmodel.model','[Content_Types].xml','_rels/.rels']);
  const xml=strFromU8(files['3D/3dmodel.model']);
  assert.match(xml,/unit="millimeter"/);
  assert.match(xml,/Desenho da frente/);
  assert.doesNotMatch(xml,/Desenho do verso/);
  assert.equal(xml.match(/<item /g).length,5);
});
