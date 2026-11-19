import {ballSpacing,pressDimensions} from './press.js';
import {readSolid,solidModule} from './solid.js';

export async function ballLattice(state,motif){
  const {CrossSection,Manifold}=await solidModule();
  const resources=[];
  const keep=value=>{resources.push(value);return value;};
  const {diskRadius:radius,rimWidth,outer}=pressDimensions(state);
  const pitch=state.line+state.gap;
  const pinRadius=1.1;
  try{
    const blank=keep(CrossSection.circle(radius,128));
    const inner=keep(CrossSection.circle(radius-rimWidth,128));
    const ring=keep(blank.subtract(inner));
    const bands=[];
    const angles=state.pattern==='diamond'?[45,135]:state.pattern==='triangle'?[0,60,120]:[0,90];
    for(const angle of angles){
      for(let i=-Math.ceil(radius/pitch);i<=Math.ceil(radius/pitch);i++){
        const band=keep(CrossSection.square([radius*2.1,state.line],true));
        bands.push(keep(keep(band.translate(0,i*pitch)).rotate(angle)));
      }
    }
    const grid=keep(keep(CrossSection.union(bands)).intersect(blank));
    const material=keep(grid.add(ring));
    const samples=144, pixel=state.size/samples, contours=[];
    for(let row=0;row<samples;row++){
      const y=(row+.5)*pixel-state.size/2;
      let start=-1;
      for(let col=0;col<=samples;col++){
        const x=(col+.5)*pixel-state.size/2;
        const radial=2*Math.hypot(x,y)/state.size;
        const distortion=state.pre?1+.28*radial**2:1;
        const filled=col<samples&&motif(x*2/state.size*distortion,y*2/state.size*distortion);
        if(filled&&start<0) start=col;
        if(!filled&&start>=0){
          const x0=start*pixel-state.size/2,x1=col*pixel-state.size/2,y0=y-pixel/2,y1=y+pixel/2;
          contours.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
          start=-1;
        }
      }
    }
    const outline=keep(contours.length?new CrossSection(contours):CrossSection.square(0));
    const clipped=keep(outline.intersect(inner));
    // Keep each motif island only when it overlaps a lattice band. This
    // avoids free-floating islands in the openings while retaining solid detail.
    const islands=clipped.decompose().map(keep);
    const attached=islands.filter(island=>!keep(island.intersect(grid)).isEmpty());
    const design=keep(attached.length?CrossSection.union(attached):CrossSection.square(0));
    const position=radius+2;
    const loop=keep(keep(CrossSection.circle(5,48)).subtract(keep(CrossSection.circle(2.6,48))));
    const hanger=keep(loop.translate(0,-position));
    const rim=state.hanger?keep(ring.add(hanger)):ring;
    const pinLocation=radius-rimWidth/2;
    function pinPattern(r){
      const pin=keep(CrossSection.circle(r,32));
      return keep(CrossSection.union([30,150,270].map(angle=>{
        const radians=angle*Math.PI/180;
        return keep(pin.translate(pinLocation*Math.cos(radians),pinLocation*Math.sin(radians)));
      })));
    }
    const pins=state.join==='pins'?pinPattern(pinRadius):null;
    const holes=pins?pinPattern(pinRadius+state.clearance):null;
    const spacing=ballSpacing(state);
    const pieces=[];
    for(let side=0;side<2;side++){
      const front=side===0;
      const colored=front||state.back==='same';
      let base=material, top=rim;
      if(colored&&state.mode==='inlay') base=keep(base.subtract(design));
      if(!front&&holes){
        base=keep(base.subtract(holes));
        top=keep(top.subtract(holes));
      }
      const solids=[keep(base.extrude(state.thickness)),keep(top.extrude(Math.max(2.4,state.thickness)))];
      if(front&&pins) solids.push(keep(pins.extrude(Math.max(2.4,state.thickness)+1.2)));
      const center={x:outer+side*spacing,y:Math.max(outer,position+5),color:state.lattice};
      const combined=keep(Manifold.union(solids));
      pieces.push(readSolid(combined,{
        ...center,name:front?'Malha da frente':'Malha do verso'
      }));
      if(colored&&!design.isEmpty()){
        const supported=state.mode==='raised'?keep(design.intersect(grid)):design;
        let decoration=keep(supported.extrude(state.mode==='raised'?.8:state.thickness));
        if(state.mode==='raised') decoration=keep(decoration.translate(0,0,state.thickness));
        pieces.push(readSolid(decoration,{...center,color:state.design,name:front?'Desenho da frente':'Desenho do verso'}));
      }
    }
    return pieces;
  }finally{for(const value of resources.reverse()) value.delete();}
}
