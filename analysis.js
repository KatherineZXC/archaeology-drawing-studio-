export function components(image,width,height){
 const mask=new Uint8Array(width*height),queue=new Int32Array(width*height),out=[];
 for(let i=0;i<mask.length;i++){const p=i*4;mask[i]=image[p+3]>80&&image[p]<150&&image[p+1]<150&&image[p+2]<150?1:0;}
 for(let p=0;p<mask.length;p++){if(!mask[p])continue;let head=0,tail=1,x0=width,y0=height,x1=0,y1=0;queue[0]=p;mask[p]=0;
 while(head<tail){const v=queue[head++],x=v%width,y=Math.floor(v/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
 for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){const n=yy*width+xx;if(mask[n]){mask[n]=0;queue[tail++]=n;}}}
 if(tail>=2)out.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,n:tail});}return out;
}
const union=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y),n:(a.n||0)+(b.n||0)});
const distance=(a,b)=>Math.hypot(Math.max(0,a.x-b.x-b.w,b.x-a.x-a.w),Math.max(0,a.y-b.y-b.h,b.y-a.y-a.h));
export function groupArtifacts(image,width,height,count){
 const all=components(image,width,height),min=height*.045;
 let cores=all.filter(a=>a.n>35&&a.h>min&&a.w>min*.18&&a.w<width*.97&&a.h<height*.97);
 cores=cores.filter((a,idx)=>!cores.some((b,j)=>j!==idx&&b.w*b.h>a.w*a.h&&a.x>=b.x-3&&a.y>=b.y-3&&a.x+a.w<=b.x+b.w+3&&a.y+a.h<=b.y+b.h+3));
 // A narrow section at left belongs with its wider elevation at right, at comparable height.
 for(let i=0;i<cores.length;i++){const a=cores[i];if(a.w/a.h>.48)continue;let best=-1,bestGap=Infinity;for(let j=0;j<cores.length;j++){if(i===j)continue;const b=cores[j],gap=b.x-(a.x+a.w),overlap=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(b.w/b.h>.48&&gap>=-4&&gap<Math.max(a.h,b.h)*.9&&overlap>Math.min(a.h,b.h)*.65&&Math.max(a.h,b.h)/Math.min(a.h,b.h)<2.4&&gap<bestGap){best=j;bestGap=gap;}}if(best>=0){const merged=union(a,cores[best]);cores=cores.filter((_,j)=>j!==i&&j!==best);cores.push(merged);i=-1;}}
 while(cores.length>count){let pair=null,best=Infinity;for(let i=0;i<cores.length;i++)for(let j=i+1;j<cores.length;j++){const a=cores[i],b=cores[j],score=distance(a,b)+Math.abs(a.y+a.h/2-b.y-b.h/2)*.5;if(score<best){best=score;pair=[i,j];}}const [a,b]=pair,merged=union(cores[a],cores[b]);cores=cores.filter((_,j)=>j!==a&&j!==b);cores.push(merged);}
 if(cores.length!==count)throw Error(`找到 ${cores.length} 组主要轮廓，与填写的 ${count} 件不同。请检查线稿图层，或手动增加器物。`);
 const expanded=cores.map(a=>({...a}));
 for(const a of all){let best=0,minDist=Infinity;cores.forEach((b,n)=>{const dist=distance(a,b);if(dist<minDist){minDist=dist;best=n;}});if(minDist<Math.max(12,Math.min(width,height)*.025))expanded[best]=union(expanded[best],a);}
 const pad=Math.max(6,width*.006);return expanded.map(a=>({x:Math.max(0,a.x-pad),y:Math.max(0,a.y-pad),w:Math.min(width,a.x+a.w+pad)-Math.max(0,a.x-pad),h:Math.min(height,a.y+a.h+pad)-Math.max(0,a.y-pad)})).sort((a,b)=>Math.abs((a.y+a.h/2)-(b.y+b.h/2))>height*.12?a.y-b.y:a.x-b.x);
}
export function gridSpacing(image,width,height){
 const x=new Float64Array(width),y=new Float64Array(height);let total=0;
 for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const p=(yy*width+xx)*4,r=image[p],g=image[p+1],b=image[p+2];if(r>120&&r-g>15&&r-b>25){const strength=(r-g)+(r-b);x[xx]+=strength;y[yy]+=strength;total++;}}
 if(total<width*height*.01)return null;
 function estimate(values){const mean=values.reduce((a,b)=>a+b,0)/values.length,peaks=[];for(let n=2;n<values.length-2;n++)if(values[n]>mean*1.65&&values[n]>=values[n-1]&&values[n]>values[n+1]){if(peaks.length&&n-peaks[peaks.length-1]<5){if(values[n]>values[peaks[peaks.length-1]])peaks[peaks.length-1]=n;}else peaks.push(n);}
 const ds=peaks.slice(1).map((n,i)=>n-peaks[i]).filter(n=>n>=12&&n<values.length*.1);if(ds.length<5)return null;const sorted=[...ds].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],near=ds.filter(n=>Math.abs(n-median)<median*.18);return near.length>=5?near.reduce((a,b)=>a+b,0)/near.length:null;}
 function coarse(values){const mean=values.reduce((a,b)=>a+b,0)/values.length;let best=0,period=0;for(let lag=15;lag<Math.min(160,values.length/8);lag++){let dot=0,aa=0,bb=0;for(let k=0;k<values.length-lag;k++){const a=values[k]-mean,b=values[k+lag]-mean;dot+=a*b;aa+=a*a;bb+=b*b;}const corr=dot/Math.sqrt(aa*bb);if(corr>best){best=corr;period=lag;}}if(best<.7)return null;let phase=0,strength=0;for(let p=0;p<period;p++){let sum=0;for(let n=p;n<values.length;n+=period)sum+=values[n];if(sum>strength){strength=sum;phase=p;}}let a=0,b=0,na=0,nb=0,k=0;for(let n=phase;n<values.length;n+=period,k++){if(values[n]<mean)continue;if(k%2){b+=values[n];nb++;}else{a+=values[n];na++;}}if(na&&nb&&Math.max(a/na,b/nb)/Math.min(a/na,b/nb)>1.12)period*=2;return period;}
 const a=coarse(x),b=coarse(y);return a&&b&&Math.abs(a-b)<Math.max(a,b)*.12?{spacing:(a+b)/2,x:a,y:b}:null;
}
export function suggestDescriptions(rects,width,height){
 // Candidate whitespace immediately right or below each complete group; exclude other groups.
 return rects.map((r,idx)=>{const proposals=[{x:r.x+r.w+width*.006,y:Math.max(0,r.y),w:width*.27,h:Math.max(height*.14,r.h*.8),side:'右侧'},{x:Math.max(0,r.x),y:r.y+r.h+height*.006,w:Math.max(r.w,width*.23),h:height*.13,side:'下方'}];
 for(const p of proposals){p.w=Math.min(p.w,width-p.x-width*.01);p.h=Math.min(p.h,height-p.y-height*.035);p.score=p.w*p.h;for(const [j,o]of rects.entries())if(j!==idx){const overlap=Math.max(0,Math.min(p.x+p.w,o.x+o.w)-Math.max(p.x,o.x))*Math.max(0,Math.min(p.y+p.h,o.y+o.h)-Math.max(p.y,o.y));if(overlap>0)p.score-=overlap*4;}}
 const p=proposals.filter(p=>p.w>width*.06&&p.h>height*.04).sort((a,b)=>b.score-a.score)[0];return p?{x:Math.round(p.x),y:Math.round(p.y),w:Math.round(p.w),h:Math.round(p.h)}:null;});
}
