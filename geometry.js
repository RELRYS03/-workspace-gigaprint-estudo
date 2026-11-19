export const shapes = {
  ball: 'Bola', egg: 'Ovo', finial: 'Pendente', bell: 'Sino', star: 'Estrela',
  heart: 'Coração', tree: 'Árvore', cane: 'Bengala', duck: 'Pato', pig: 'Porco',
};
export const defaults = {
  shape:'ball', size:80, depth:70, pattern:'square', thickness:1.2, line:1.2, gap:5,
  motif:'snowflake', name:'', text:'Merry Christmas', font:'round', designSize:70,
  threshold:128, mode:'inlay', pre:true, back:'same', lattice:'#bd233e', design:'#fff0d5',
  mold:'#3a8360', clearance:0.3, join:'pins', hanger:true,
};
const TAU = 2 * Math.PI;
const ellipse = (x,y,cx,cy,rx,ry) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 < 1;
function polygon(x,y,points) {
  let inside = false;
  for (let i=0,j=points.length-1; i<points.length; j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if ((ay>y)!==(by>y) && x < (bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
export const star = Array.from({length:10}, (_,i)=>{
  const angle=i*TAU/10-Math.PI/2, r=i%2?.46:.96;
  return [r*Math.cos(angle),r*Math.sin(angle)];
});
export function contains(shape,x,y) {
  switch (shape) {
    case 'egg': return ellipse(x,y,0,0,.68+.16*y,.98);
    case 'finial': return polygon(x,y,[[0,-.98],[.2,-.45],[.62,-.1],[.79,.36],[.57,.72],[0,.96],[-.57,.72],[-.79,.36],[-.62,-.1],[-.2,-.45]]);
    case 'bell': return ellipse(x,y,0,-.25,.48,.65)||polygon(x,y,[[-.45,-.22],[.45,-.22],[.82,.69],[-.82,.69]])||ellipse(x,y,0,.72,.18,.2);
    case 'star': return polygon(x,y,star);
    case 'heart': return ellipse(x,y,-.4,-.32,.48,.45)||ellipse(x,y,.4,-.32,.48,.45)||polygon(x,y,[[-.84,-.22],[.84,-.22],[0,.94]]);
    case 'tree': return polygon(x,y,[[0,-.99],[.47,-.33],[.3,-.33],[.64,.13],[.44,.13],[.85,.66],[.15,.66],[.15,.94],[-.15,.94],[-.15,.66],[-.85,.66],[-.44,.13],[-.64,.13],[-.3,-.33],[-.47,-.33]]);
    case 'cane': return (x>-.49&&x<-.15&&y>-.48&&y<.94)||(y<-.4&&Math.abs(Math.hypot(x-.01,y+.4)-.33)<.17)||(x>.16&&x<.52&&y>-.42&&y<-.22);
    case 'duck': return ellipse(x,y,-.12,.36,.78,.49)||ellipse(x,y,.28,-.33,.37,.41)||ellipse(x,y,.68,-.27,.24,.11);
    case 'pig': return ellipse(x,y,0,.13,.86,.74)||polygon(x,y,[[-.78,-.23],[-.82,-.86],[-.29,-.37]])||polygon(x,y,[[.78,-.23],[.82,-.86],[.29,-.37]]);
    default: return Math.hypot(x,y)<.97;
  }
}
export function validate(s) {
  for(const [key,label,min,max] of [['size','Tamanho',40,150],['thickness','Espessura',.6,2],['line','Largura',.8,3],['gap','Furo',2,12],['clearance','Folga',0,1]]) {
    if(!Number.isFinite(s[key]) || s[key]<min || s[key]>max) return `${label}: use um valor entre ${min} e ${max} mm.`;
  }
  return '';
}
const distanceToLine = (value, spacing) => Math.abs(value - Math.round(value / spacing)*spacing);
export function makeModel(s, motif=()=>false, resolution=150) {
  const n=resolution, edge=s.size/2, pitch=s.line+s.gap;
  const body=new Uint8Array(n*n), flat=new Uint8Array(n*n), heights=new Float32Array(n*n), holes=new Uint8Array(n*n);
  const coordinates=i=>(i+.5-n/2)*2.32/n;
  const inside=(x,y)=>contains(s.shape,x,y);
  const pinCenters=[[-.45,.29],[.45,.29],[0,-.38]].map(([px,py])=>{
    while(Math.hypot(px,py)<.97 && inside(px*1.08,py*1.08)) { px*=1.08; py*=1.08; }
    return [px*.96,py*.96];
  });
  for(let row=0;row<n;row++) for(let col=0;col<n;col++) {
    const i=row*n+col, x=coordinates(col), y=coordinates(row), mmX=x*edge, mmY=y*edge;
    const inShape=inside(x,y), thickness=3.1/edge;
    const rim=inShape&&[[thickness,0],[-thickness,0],[0,thickness],[0,-thickness]].some(([dx,dy])=>!inside(x+dx,y+dy));
    const ring=s.hanger && Math.abs(Math.hypot(x,y+.98)-.088)<.037 && y<-.89;
    if(!inShape&&!ring) continue;
    let grid=distanceToLine(mmX,pitch)<s.line/2||distanceToLine(mmY,pitch)<s.line/2;
    if(s.pattern==='diamond') grid=[mmX+mmY,mmX-mmY].some(v=>distanceToLine(v/Math.SQRT2,pitch)<s.line/2);
    if(s.pattern==='triangle') grid=[mmY,mmX*.866+mmY*.5,mmX*.866-mmY*.5].some(v=>distanceToLine(v,pitch)<s.line/2);
    const radial=Math.hypot(x,y);
    const distortion=s.pre?1+.28*radial**2:1;
    const pinDistance=Math.min(...pinCenters.map(([px,py])=>Math.hypot(x-px,y-py)*edge));
    const mark=inShape&&motif(x*distortion,y*distortion);
    body[i]=rim||ring?3:mark?2:grid?1:0;
    flat[i]=body[i];
    if(s.join==='pins'&&inShape) {
      if(pinDistance<2.1) flat[i]=4;
      if(pinDistance<2.1+s.clearance) holes[i]=1;
    }
    const dx=Math.max(0,1-radial**2);
    heights[i]=inShape?edge*s.depth/100*Math.sqrt(dx):0;
  }
  return {n, step:2.32*edge/n, body,flat,heights,holes};
}
