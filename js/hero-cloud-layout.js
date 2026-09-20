// Layout offsets deliberately ignore the hero's entrance transforms.
export function layoutBox(element,stage) {
  let left=0,top=0,current=element;
  while(current&&current!==stage){left+=current.offsetLeft;top+=current.offsetTop;current=current.offsetParent;}
  return {left,top,right:left+element.offsetWidth,bottom:top+element.offsetHeight};
}
export const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function cloudLayout(stage,product,content,proof,marks,label) {
  const logos=layoutBox(marks,stage),caption=layoutBox(label,stage),rock=layoutBox(product,stage);
  const w=stage.clientWidth,h=stage.clientHeight;
  return {w,h,layerH:h*.25,left:rock.left+product.offsetWidth*.025,
    right:rock.right-product.offsetWidth*.02,rockWidth:product.offsetWidth,
    logoRight:Math.max(logos.right,caption.right),
    clearance:Math.max(6,h-Math.max(logos.bottom,caption.bottom)-32)};
}
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
