// A single integer source rectangle is shared by every layer. Never use DPI to scale pixels.
export function sourceRect(r, step, width, height) {
  const x = Math.max(0, Math.floor(r.x * step));
  const y = Math.max(0, Math.floor(r.y * step));
  const right = Math.min(width, Math.ceil((r.x + r.w) * step));
  const bottom = Math.min(height, Math.ceil((r.y + r.h) * step));
  if (right <= x || bottom <= y) throw Error('裁剪框不在原图范围内。');
  return {x, y, w: right - x, h: bottom - y};
}
export function croppedLayer(original, imageData, visible) {
  if (original.mask) throw Error('此 PSD 含蒙版，当前无法保证无损裁剪，请先在 Photoshop 中处理蒙版。');
  const modes = {norm:'normal', 'mul ':'multiply', scrn:'screen', over:'overlay', dark:'darken', lite:'lighten'};
  if (!modes[original.blend]) throw Error('当前无法无损保留此图层的混合模式：' + original.name);
  // decodeLayer returns pixels padded to the common crop rectangle. No per-layer repositioning.
  return {name:original.name, left:0, top:0, imageData, opacity:original.opacity,
    hidden:!visible, blendMode:modes[original.blend]};
}
