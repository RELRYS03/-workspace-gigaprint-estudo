import {makeModel} from './geometry.js';
import {export3mf, printableParts} from './export.js';
self.onmessage=({data:{state,raster}})=>{
  const motif=(x,y)=>{
    const col=Math.floor((x+1)*128), row=Math.floor((y+1)*128);
    return col>=0&&col<256&&row>=0&&row<256&&Boolean(raster[row*256+col]);
  };
  try {
    const bytes=export3mf(printableParts(makeModel(state,motif),state));
    self.postMessage({bytes},[bytes.buffer]);
  } catch {
    self.postMessage({error:true});
  }
};
