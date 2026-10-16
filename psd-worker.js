import {indexPsd,decodeLayer} from './psd-stream.js';
let file,meta,step;
const makeCanvas=(w,h)=>new OffscreenCanvas(w,h);
async function layerCanvas(l,rect,s){const image=await decodeLayer(file,l,rect,s),c=makeCanvas(image.width,image.height);c.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return c;}
self.onmessage=async({data:m})=>{try{
  if(m.type==='crop-layer'){const image=await decodeLayer(file,meta.layers[m.index],m.rect,1);self.postMessage({type:'crop-layer',requestId:m.requestId,image},[image.data.buffer]);}
  if(m.type==='open'){file=m.file;meta=await indexPsd(file);step=Math.max(1,Math.ceil(Math.max(meta.width,meta.height)/2600));self.postMessage({type:'meta',meta,step});for(let i=0;i<meta.layers.length;i++){const l=meta.layers[i],c=await layerCanvas(l,{x:0,y:0,w:meta.width,h:meta.height},step),bitmap=c.transferToImageBitmap();self.postMessage({type:'layer',index:i,bitmap},[bitmap]);}self.postMessage({type:'ready'});}
  if(m.type==='crop'){const r=m.rect,c=makeCanvas(r.w,r.h),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,r.w,r.h);for(const idx of m.indices){const l=meta.layers[idx],image=await layerCanvas(l,r,1);ctx.globalAlpha=l.opacity;ctx.globalCompositeOperation=({mul:'multiply',scrn:'screen',over:'overlay',dark:'darken',lite:'lighten'})[l.blend.trim()]||'source-over';ctx.drawImage(image,0,0);image.width=1;image.height=1;}const bitmap=c.transferToImageBitmap();self.postMessage({type:'crop',requestId:m.requestId,bitmap},[bitmap]);}
}catch(error){self.postMessage({type:'error',requestId:m.requestId,message:error.message});}};
