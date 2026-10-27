import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Point = { x: number; y: number };
const W = 220, H = 253;

export function PortraitCropper({ source, onSave, onClose }: { source: string; onSave: (cropped: string, original: string) => void; onClose: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ x: number; y: number; distance: number; offsetX: number; offsetY: number; zoom: number } | null>(null);
  const state = useRef({ x: 0, y: 0, zoom: 1 });
  const [view, setView] = useState(state.current);
  const [ready, setReady] = useState(false);
  const dimensions = () => { const img = image.current!; const base = Math.max(W / img.naturalWidth, H / img.naturalHeight); return { width: img.naturalWidth * base, height: img.naturalHeight * base }; };
  const update = (next: typeof view) => {
    if (!image.current?.naturalWidth) return;
    const { width, height } = dimensions();
    const zoom = Math.max(1, Math.min(3, next.zoom));
    const x = Math.max((W - width * zoom) / 2, Math.min((width * zoom - W) / 2, next.x));
    const y = Math.max((H - height * zoom) / 2, Math.min((height * zoom - H) / 2, next.y));
    state.current = { x, y, zoom }; setView(state.current);
  };
  const center = () => { const points = [...pointers.current.values()]; return { x: points.reduce((n,p)=>n+p.x,0)/points.length, y: points.reduce((n,p)=>n+p.y,0)/points.length, distance: points.length > 1 ? Math.hypot(points[0].x-points[1].x, points[0].y-points[1].y) : 0 }; };
  const begin = () => { const c = center(); gesture.current = { ...c, offsetX: state.current.x, offsetY: state.current.y, zoom: state.current.zoom }; };
  const save = () => {
    const img = image.current; if (!img?.naturalWidth) return;
    const originalCanvas = document.createElement('canvas');
    const ratio = Math.min(1, 1400 / Math.max(img.naturalWidth,img.naturalHeight));
    originalCanvas.width = Math.round(img.naturalWidth * ratio); originalCanvas.height = Math.round(img.naturalHeight * ratio);
    originalCanvas.getContext('2d')!.drawImage(img,0,0,originalCanvas.width,originalCanvas.height);
    const crop = document.createElement('canvas'); crop.width = W * 2; crop.height = H * 2;
    const { width, height } = dimensions(), {x,y,zoom} = state.current;
    const scaledWidth = width * zoom * 2, scaledHeight = height * zoom * 2;
    crop.getContext('2d')!.drawImage(img,(crop.width-scaledWidth)/2+x*2,(crop.height-scaledHeight)/2+y*2,scaledWidth,scaledHeight);
    onSave(crop.toDataURL('image/jpeg',.87), originalCanvas.toDataURL('image/jpeg',.85));
  };
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }; window.addEventListener('keydown',key,true); return () => window.removeEventListener('keydown',key,true); },[onClose]);
  const { width = W, height = H } = ready ? dimensions() : {};
  return createPortal(<div className="crop-overlay" role="dialog" aria-modal="true" aria-label="裁剪人物肖像">
    <div className="crop-dialog"><div className="crop-heading"><div><small>肖像档案</small><h2>调整六边形肖像</h2></div><button type="button" onClick={onClose} aria-label="关闭裁剪">×</button></div>
      <div className="crop-body"><div className="crop-workspace"><div className="crop-stage" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();}} onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const c=center(),g=gesture.current!;update({zoom:g.zoom*(c.distance&&g.distance?c.distance/g.distance:1),x:g.offsetX+c.x-g.x,y:g.offsetY+c.y-g.y});}} onPointerUp={e=>{pointers.current.delete(e.pointerId);if(pointers.current.size)begin();else gesture.current=null;}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);gesture.current=null;}} onWheel={e=>{e.preventDefault();update({...state.current,zoom:state.current.zoom*(e.deltaY<0?1.07:.93)});}}>
        <span className="crop-window"><img ref={image} src={source} alt="待裁剪的肖像" draggable={false} onLoad={()=>{setReady(true);state.current={x:0,y:0,zoom:1};setView(state.current);}} style={{width,height,transform:`translate(-50%,-50%) translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}/></span>
        <svg viewBox="0 0 164 188.6" preserveAspectRatio="none" aria-hidden="true"><path d="M82 1 L154 36 L154 149 L82 187 L10 149 L10 36 Z"/><path d="M82 5 L150 39 L150 146 L82 183 L14 146 L14 39 Z"/></svg>
      </div><p>单指拖动 · 双指缩放<br/>电脑可拖动，并用滚轮缩放</p></div>
      <aside className="crop-controls"><h3>构图</h3><p>移动肖像，把人物放在六边形中央。原图会保留，之后仍可重新裁剪。</p><label>缩放<input type="range" min="1" max="3" step=".01" value={view.zoom} onChange={e=>update({...state.current,zoom:Number(e.target.value)})}/></label><button type="button" className="text-action" onClick={()=>update({x:0,y:0,zoom:1})}>重置位置</button><div><button type="button" className="site-button site-button-subtle" onClick={onClose}>取消</button><button type="button" className="primary-action" onClick={save} disabled={!ready}>应用裁剪 ↗</button></div></aside></div>
    </div>
  </div>, document.body);
}
