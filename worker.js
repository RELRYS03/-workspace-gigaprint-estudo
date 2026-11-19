import wasmURL from 'manifold-3d/manifold.wasm?url';
import {configureSolidRuntime} from './solid.js';
import {ballLattice} from './ball-lattice.js';
import {zipSync} from 'fflate';
import {exportSTL} from './mesh.js';
import {makeModel} from './geometry.js';
import {export3mf, printableParts} from './export.js';
configureSolidRuntime(wasmURL);
self.onmessage=async ({data:{state,raster,edit,zip}})=>{
  const motif=(x,y)=>{
    const col=Math.floor((x+1)*128), row=Math.floor((y+1)*128);
    return col>=0&&col<256&&row>=0&&row<256&&Boolean(raster[row*256+col]);
  };
  try {
    const model=makeModel(state,motif);
    const parts=state.shape==='ball'
      ?[...await ballLattice(state,motif),...printableParts(model,state,true)]
      :printableParts(model,state);
    if(edit){self.postMessage({parts});return;}
    const threeMF=export3mf(parts);
    const bytes=zip?zipSync(Object.fromEntries([
      ['enfeite.3mf',threeMF],
      ...parts.map((part,index)=>[`peca-${index+1}.stl`,new Uint8Array(exportSTL([part]))])
    ])):threeMF;
    self.postMessage({bytes},[bytes.buffer]);
  } catch {
    self.postMessage({error:true});
  }
};
