const SEGMENTS=128;
const RINGS=32;

export function pressDimensions(state){
  const diskRadius=state.size*.485;
  const rimWidth=4.5;
  const radius=diskRadius-rimWidth;
  const depth=state.size*state.depth/200;
  const gap=state.thickness+state.clearance+(state.mode==='raised'?.8:0);
  const cavityRadius=radius+gap;
  const outer=cavityRadius+5;
  const floor=4;
  return {diskRadius,rimWidth,radius,depth,gap,cavityRadius,outer,floor,opening:floor+depth+gap};
}

export function ballSpacing(state){
  const {diskRadius,outer}=pressDimensions(state);
  return Math.max(outer,diskRadius+(state.hanger?7:0))*2+3;
}

export function ballPress(state,female){
  const {radius,depth,gap,cavityRadius,outer,floor,opening}=pressDimensions(state);
  // Rings go from bottom center, around the outside, back to top center.
  // The female profile descends from its open lip to the cavity floor.
  const profile=[[0,0],[outer,0],[outer,female?opening:floor]];
  for(let i=0;i<=RINGS;i++){
    const angle=(i/RINGS)*Math.PI/2;
    const r=i===RINGS?0:(female?cavityRadius:radius)*Math.cos(angle);
    const cap=(female?depth+gap:depth)*Math.sin(angle);
    profile.push([r,female?opening-cap:floor+cap]);
  }
  const vertices=[],triangles=[];
  let previous;
  for(const [r,z] of profile){
    const start=vertices.length;
    const count=r===0?1:SEGMENTS;
    for(let i=0;i<count;i++){
      const a=i*2*Math.PI/SEGMENTS;
      vertices.push([r*Math.cos(a),r*Math.sin(a),z]);
    }
    if(previous){
      for(let i=0;i<SEGMENTS;i++){
        const j=(i+1)%SEGMENTS;
        if(previous.count===1) triangles.push([previous.start,start+j,start+i]);
        else if(count===1) triangles.push([previous.start+i,previous.start+j,start]);
        else triangles.push([previous.start+i,previous.start+j,start+j],[previous.start+i,start+j,start+i]);
      }
    }
    previous={start,count};
  }
  return {vertices,triangles};
}
