// Keep closing punctuation with its preceding text, opening punctuation with its following text,
// and Latin identifiers / measurements intact. Explicit paragraph breaks remain intact.
export function textLines(ctx, text, width) {
  const lines=[];
  for(const paragraph of text.split(/\r?\n/)) {
    const raw=paragraph.match(/[A-Za-z0-9]+(?:[.：:–—/\-][A-Za-z0-9]+)*|[^\r\n]/gu)||[];
    const tokens=[];
    for(const token of raw) {
      if(tokens.length && (/^[，。！？、；：,.!?;:%％）】》」』”’]/u.test(token) || /[（【《「『“‘]$/u.test(tokens.at(-1)))) tokens[tokens.length-1]+=token;
      else tokens.push(token);
    }
    let line='';
    for(const token of tokens) {
      if(line && ctx.measureText(line+token).width>width) {lines.push(line.trimEnd());line='';}
      if(line || token.trim()) line+=token;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function editableText(lines, {fontSize, leading, left, baseline}) {
  const text=lines.join('\n'),styleRuns=[];
  for(const ch of text) {
    const enclosedNumber=/[\u2460-\u2473\u24ea\u3251-\u325f\u32b1-\u32bf]/u.test(ch);
    const name=enclosedNumber||/[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/u.test(ch)?'SimSun':'TimesNewRomanPSMT';
    const last=styleRuns.at(-1);
    if(last?.style.font.name===name)last.length+=ch.length;
    else styleRuns.push({length:ch.length,style:{font:{name}}});
  }
  return {text,shapeType:'point',transform:[1,0,0,1,left,baseline],antiAlias:'sharp',
    style:{font:{name:'SimSun'},fontSize,autoLeading:false,leading,fillColor:{r:8,g:14,b:10}},
    styleRuns,paragraphStyle:{justification:'left',autoHyphenate:false}};
}
