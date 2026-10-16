// File-slice PSD reader: metadata and one strip at a time, no full-document RGBA allocation.
const ascii=a=>String.fromCharCode(...a);
class Reader {
  constructor(file,start=0){this.file=file;this.pos=start;this.start=-1;this.bytes=new Uint8Array();}
  async take(n){if(n<0||this.pos+n>this.file.size)throw Error('PSD 数据不完整。');if(this.pos<this.start||this.pos+n>this.start+this.bytes.length){this.start=this.pos;this.bytes=new Uint8Array(await this.file.slice(this.pos,Math.min(this.file.size,this.pos+Math.max(n,65536))).arrayBuffer());}const a=this.bytes.subarray(this.pos-this.start,this.pos-this.start+n);this.pos+=n;return a;}
  async u16(){const a=await this.take(2);return a[0]*256+a[1];}
  async i16(){const n=await this.u16();return n>32767?n-65536:n;}
  async u32(){const a=await this.take(4);return new DataView(a.buffer,a.byteOffset,4).getUint32(0);}
  async i32(){const n=await this.u32();return n>2147483647?n-4294967296:n;}
}
export async function indexPsd(file){
  const r=new Reader(file),h=await r.take(26),v=new DataView(h.buffer,h.byteOffset,h.byteLength);
  if(ascii(h.subarray(0,4))!=='8BPS'||v.getUint16(4)!==1)throw Error('仅支持 PSD，暂不支持 PSB。');
  const height=v.getUint32(14),width=v.getUint32(18),depth=v.getUint16(22),color=v.getUint16(24);
  if(depth!==8||color!==3)throw Error('请将图纸另存为 RGB、8 位/通道的 PSD。');
  if(width*height>200000000)throw Error('图纸超过 2 亿像素，请在 Photoshop 中分张。');
  const colorLen=await r.u32();r.pos+=colorLen;const resourceLen=await r.u32(),resourceEnd=r.pos+resourceLen;let dpi=300;
  while(r.pos+12<resourceEnd){await r.take(4);const id=await r.u16();const n=(await r.take(1))[0];r.pos+=n;if((n+1)%2)r.pos++;const size=await r.u32(),start=r.pos;if(id===1005&&size>=16)dpi=(await r.u32())/65536;r.pos=start+size+(size%2);}
  r.pos=resourceEnd;const maskSize=await r.u32();if(!maskSize)throw Error('PSD 没有可读取的独立图层，请另存为带图层的 PSD。');const infoSize=await r.u32();if(!infoSize)throw Error('未找到 PSD 图层信息。');const n=Math.abs(await r.i16()),layers=[];
  for(let k=0;k<n;k++){
    const top=await r.i32(),left=await r.i32(),bottom=await r.i32(),right=await r.i32(),nc=await r.u16(),channels=[];
    for(let j=0;j<nc;j++)channels.push({id:await r.i16(),length:await r.u32()});
    await r.take(4);const blend=ascii(await r.take(4)),settings=await r.take(4),extraLen=await r.u32(),extraEnd=r.pos+extraLen;
    const ml=await r.u32();r.pos+=ml;const bl=await r.u32();r.pos+=bl;
    const nameLength=(await r.take(1))[0];let name=new TextDecoder('windows-1252').decode(await r.take(nameLength));r.pos+=(4-(nameLength+1)%4)%4;let section=0;
    while(r.pos+12<=extraEnd){const signature=ascii(await r.take(4));if(!['8BIM','8B64'].includes(signature))break;const key=ascii(await r.take(4)),len=await r.u32(),start=r.pos;if(key==='luni'){const chars=await r.u32(),raw=await r.take(Math.min(chars*2,len-4));name=new TextDecoder('utf-16be').decode(raw);}if(key==='lsct'||key==='lsdk')section=await r.u32();r.pos=start+len+(len%2);}
    r.pos=extraEnd;layers.push({id:k,name,left,top,width:right-left,height:bottom-top,channels,blend,opacity:settings[0]/255,hidden:!!(settings[2]&2),mask:ml>0,section});
  }
  for(const l of layers)for(const ch of l.channels){ch.offset=r.pos;r.pos+=ch.length;if(r.pos>file.size)throw Error('图层数据超出文件长度。');}
  return{width,height,dpi,hasGroups:layers.some(l=>l.section),layers:layers.filter(l=>!l.section&&l.width>0&&l.height>0)};
}
function unpack(src,width){const out=new Uint8Array(width);let p=0,q=0;while(p<src.length&&q<width){let n=src[p++];if(n<128){const count=n+1;if(p+count>src.length||q+count>width)throw Error('PSD 行压缩数据损坏。');out.set(src.subarray(p,p+count),q);p+=count;q+=count;}else if(n>128){const count=257-n;if(p>=src.length||q+count>width)throw Error('PSD 行压缩数据损坏。');out.fill(src[p++],q,q+count);q+=count;}}if(q!==width)throw Error('PSD 行数据不完整。');return out;}
export async function decodeLayer(file,layer,rect,step=1){
  step=Math.max(1,Math.round(step));const width=Math.ceil(rect.w/step),height=Math.ceil(rect.h/step),out=new Uint8ClampedArray(width*height*4);
  const x0=Math.max(rect.x,layer.left),x1=Math.min(rect.x+rect.w,layer.left+layer.width),y0=Math.max(rect.y,layer.top),y1=Math.min(rect.y+rect.h,layer.top+layer.height);
  if(x1<=x0||y1<=y0)return{width,height,data:out};
  const firstY=Math.max(0,Math.ceil((y0-rect.y)/step)),lastY=Math.min(height,Math.ceil((y1-rect.y)/step));
  const firstX=Math.max(0,Math.ceil((x0-rect.x)/step)),lastX=Math.min(width,Math.ceil((x1-rect.x)/step));
  const hasAlpha=layer.channels.some(c=>c.id===-1);
  if(!hasAlpha)for(let y=firstY;y<lastY;y++)for(let x=firstX;x<lastX;x++)out[(y*width+x)*4+3]=255;
  for(const channel of layer.channels){if(![-1,0,1,2].includes(channel.id))continue;const target=channel.id===-1?3:channel.id;const compression=new DataView(await file.slice(channel.offset,channel.offset+2).arrayBuffer()).getUint16(0);
    const put=(row,iy)=>{for(let ix=firstX;ix<lastX;ix++)out[(iy*width+ix)*4+target]=row[rect.x+ix*step-layer.left];};
    if(compression===0||compression===1){
      let offsets,base=channel.offset+2;if(compression===1){const bytes=await file.slice(base,base+layer.height*2).arrayBuffer(),view=new DataView(bytes);offsets=new Float64Array(layer.height+1);offsets[0]=base+layer.height*2;for(let y=0;y<layer.height;y++)offsets[y+1]=offsets[y]+view.getUint16(y*2);}
      for(let iy=firstY;iy<lastY;){const end=Math.min(lastY,iy+64),from=rect.y+iy*step-layer.top,to=rect.y+(end-1)*step-layer.top,start=compression===1?offsets[from]:base+from*layer.width,stop=compression===1?offsets[to+1]:base+(to+1)*layer.width;
        if(stop>channel.offset+channel.length)throw Error('PSD 通道长度无效。');const bytes=new Uint8Array(await file.slice(start,stop).arrayBuffer());
        for(;iy<end;iy++){const y=rect.y+iy*step-layer.top,a=compression===1?offsets[y]-start:base+y*layer.width-start,b=compression===1?offsets[y+1]-start:a+layer.width;put(compression===1?unpack(bytes.subarray(a,b),layer.width):bytes.subarray(a,b),iy);}
      }
    }else if(compression===2||compression===3){
      const reader=file.slice(channel.offset+2,channel.offset+channel.length).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let pending=new Uint8Array(),row=0,next=firstY;
      try{while(next<lastY){const part=await reader.read();if(part.done)break;const bytes=new Uint8Array(pending.length+part.value.length);bytes.set(pending);bytes.set(part.value,pending.length);let p=0;while(p+layer.width<=bytes.length){if(row===rect.y+next*step-layer.top){const data=bytes.slice(p,p+layer.width);if(compression===3)for(let x=1;x<data.length;x++)data[x]=(data[x]+data[x-1])&255;put(data,next++);}row++;p+=layer.width;if(next>=lastY)break;}pending=bytes.slice(p);}if(next<lastY)throw Error('PSD ZIP 通道数据不完整。');}finally{await reader.cancel();}
    }else throw Error('该 PSD 使用暂不支持的通道压缩，请另存为标准 PSD。');
  }
  return{width,height,data:out};
}
