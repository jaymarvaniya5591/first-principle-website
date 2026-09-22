// Build-time design geometry measured from the approved master screenshot.
// Runtime code never reads the viewport to reposition clouds.
export const referenceCloudLayout = Object.freeze({
  w: 1265, h: 585, layerH: 146.25,
  left: 555.625, right: 1343.5, rockWidth: 825,
  logoRight: 530, clearance: 53,
});
export const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Continuous height field; never release a rectangular cut-out at the rock.
export function cloudCeiling(x,layout) {
  const {h,clearance,logoRight,left,right,rockWidth}=layout;
  // This is a safety envelope ABOVE the normal 5–9% bank, not its silhouette.
  // Leaving space above texture crests prevents a level, visibly clipped top.
  const low=Math.min(h*.14,clearance),release=smoothstep(logoRight+8,logoRight+168,x);
  const flank=Math.max(Math.exp(-(((x-left)/(rockWidth*.19))**2)),Math.exp(-(((x-right)/(rockWidth*.17))**2)));
  return low+release*Math.max(0,h*(.14+.02*flank)-low);
}
export function boundaryPath(layout,inset=0) {
  const points=[];
  for(let x=0;x<layout.w;x+=8)points.push([x,layout.layerH-cloudCeiling(x,layout)+inset]);
  points.push([layout.w,layout.layerH-cloudCeiling(layout.w,layout)+inset]);
  return 'M'+points.map(([x,y])=>`${(x/layout.w*1600).toFixed(2)},${(y/layout.layerH*220).toFixed(2)}`).join(' L')+' L1600,224 L0,224 Z';
}
