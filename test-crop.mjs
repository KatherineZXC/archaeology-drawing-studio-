import assert from 'node:assert/strict';
import {writePsdUint8Array,readPsd,initializeCanvas} from 'ag-psd';
import {indexPsd,decodeLayer} from './psd-stream.js';
import {sourceRect,croppedLayer} from './crop-geometry.js';
initializeCanvas(()=>{throw Error('Unexpected canvas allocation');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
const image=(w,h,seed)=>({width:w,height:h,data:Uint8ClampedArray.from({length:w*h*4},(_,n)=>(n*17+seed)%256)});
const source={width:80,height:60,children:[{name:'offset background',left:-7,top:3,imageData:image(70,50,1)},{name:'offset lines',left:19,top:-4,opacity:.6,hidden:true,imageData:image(45,57,23)}]};
const file=new Blob([writePsdUint8Array(source,{generateThumbnail:false,trimImageData:false})]);
const meta=await indexPsd(file),roi=sourceRect({x:3.1,y:2.4,w:15.8,h:12.2},2,80,60);
assert.deepEqual(roi,{x:6,y:4,w:32,h:26});
for(let k=0;k<meta.layers.length;k++){
 const l=meta.layers[k],original=source.children.find(c=>c.name===l.name),crop=await decodeLayer(file,l,roi);
 for(let y=0;y<roi.h;y++)for(let x=0;x<roi.w;x++){
  const sx=x+roi.x-original.left,sy=y+roi.y-original.top;
  const expected=sx>=0&&sy>=0&&sx<original.imageData.width&&sy<original.imageData.height?original.imageData.data.subarray((sy*original.imageData.width+sx)*4,(sy*original.imageData.width+sx)*4+4):new Uint8Array(4);
  assert.deepEqual([...crop.data.subarray((y*roi.w+x)*4,(y*roi.w+x)*4+4)],[...expected]);
 }
}
console.log('PASS: offset layers, negative origins, partial alpha and fractional preview coordinates preserve all RGBA samples.');

const children=[];
for(const l of meta.layers) children.push(croppedLayer(l,await decodeLayer(file,l,roi),!l.hidden));
const bytes=writePsdUint8Array({width:roi.w,height:roi.h,children},{generateThumbnail:false,trimImageData:false});
const restored=readPsd(bytes,{useImageData:true,skipCompositeImageData:true});
assert.equal(restored.width,roi.w);assert.equal(restored.height,roi.h);
assert.equal(restored.children.length,children.length);
for(let n=0;n<children.length;n++){
const a=children[n],b=restored.children[n];
assert.equal(b.name,a.name);assert.equal(b.left,0);assert.equal(b.top,0);
assert.equal(!!b.hidden,!!a.hidden);assert.equal(b.opacity,a.opacity);
assert.deepEqual(b.imageData.data,a.imageData.data);
}
console.log('PASS: exported PSD preserves crop pixels, names, visibility and opacity.');
