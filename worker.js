import {makeModel} from './geometry.js';
import {export3mf, printableParts} from './export.js';
self.onmessage=({data:{state,raster,edit}})=>{
  const motif=(x,y)=>{
    const col=Math.floor((x+1)*128), row=Math.floor((y+1)*128);
    return col>=0&&col<256&&row>=0&&row<256&&Boolean(raster[row*256+col]);
  };
  try {
    const parts=printableParts(makeModel(state,motif),state);
    if(edit){self.postMessage({parts});return;}
    const bytes=export3mf(parts);
    self.postMessage({bytes},[bytes.buffer]);
  } catch {
    self.postMessage({error:true});
  }
};
