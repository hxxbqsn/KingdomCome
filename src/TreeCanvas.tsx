import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { childrenOf, relativesOf, yearsOf, type Person } from './data';
import { PortraitImage } from './PortraitImage';

type Point = { x: number; y: number };
type Layout = { positions: Map<string, Point>; width: number; height: number; lines: { key: string; path: string; ids: string[]; kind: 'parent'|'spouse'|'lover' }[]; generations: number[] };
const SIZE = 164;

function makeLayout(people: Person[], density: 'comfortable' | 'compact'): Layout {
  const STEP=density==='compact'?200:230;
  const ROW=density==='compact'?225:255;
  const byId = new Map(people.map(p => [p.id, p]));
  const roots=new Map(people.map(p=>[p.id,p.id]));
  const root=(id:string):string=>{const next=roots.get(id)!;if(next===id)return id;const result=root(next);roots.set(id,result);return result;};
  people.forEach(p=>[...p.spouseIds,...p.loverIds].forEach(id=>{if(byId.has(id))roots.set(root(id),root(p.id));}));
  const partnerGroups=new Map<string,Person[]>();
  people.forEach(p=>{const key=root(p.id);partnerGroups.set(key,[...(partnerGroups.get(key)||[]),p]);});
  const groupDepths=new Map<string,number>(),visiting=new Set<string>();
  const depthOf=(key:string):number=>{
    if(groupDepths.has(key))return groupDepths.get(key)!;
    if(visiting.has(key))return 0;
    visiting.add(key);
    const parents=(partnerGroups.get(key)||[]).flatMap(p=>p.parentIds).filter(id=>byId.has(id)&&root(id)!==key);
    const depth=parents.length?Math.max(...parents.map(id=>depthOf(root(id))+1)):0;
    visiting.delete(key);groupDepths.set(key,depth);return depth;
  };
  const depths=new Map(people.map(p=>[p.id,depthOf(root(p.id))]));
  const positions = new Map<string, Point>();
  const maxDepth = Math.max(0, ...depths.values());
  const width = Math.max(1180, Math.max(...Array.from({ length: maxDepth + 1 }, (_, row) => people.filter(p => depths.get(p.id) === row).length * STEP + 280), 0));
  for (let row = 0; row <= maxDepth; row++) {
    const rowPeople = people.filter(p => depths.get(p.id) === row);
    const used = new Set<string>();
    const units: Person[][] = [];
    rowPeople.forEach(p => {
      if (used.has(p.id)) return;
      const spouse = [...p.spouseIds,...p.loverIds].map(id => byId.get(id)).find(s => s && depths.get(s.id) === row && !used.has(s.id));
      const unit = spouse ? [p, spouse] : [p];
      unit.forEach(member => used.add(member.id));
      units.push(unit);
    });
    const anchor = (unit: Person[]) => {
      const parentXs = unit.flatMap(p => p.parentIds.map(id => positions.get(id)?.x).filter((x): x is number => x !== undefined));
      return parentXs.length ? parentXs.reduce((a, b) => a + b, 0) / parentXs.length : width / 2;
    };
    if (row > 0) units.sort((a,b) => anchor(a) - anchor(b));
    const unitWidths = units.map(unit => unit.length * STEP);
    const gap = density==='compact'?55:95;
    const total = unitWidths.reduce((a,b) => a+b,0) + Math.max(0, units.length-1)*gap;
    const meanAnchor = row > 0 && units.length ? units.reduce((sum,u)=>sum+anchor(u),0)/units.length : width/2;
    let cursor = Math.max(55, Math.min(width-total-55, meanAnchor-total/2));
    units.forEach((unit, idx) => {
      unit.forEach((p,j) => positions.set(p.id, { x: cursor + j*STEP + (STEP-SIZE)/2, y: 82 + row*ROW }));
      cursor += unitWidths[idx] + gap;
    });
  }
  const lines: Layout['lines'] = [];
  const spouses = new Set<string>();
  people.forEach(p => p.spouseIds.forEach(id => {
    const other = byId.get(id); const a = positions.get(p.id); const b = positions.get(id);
    if (!other || !a || !b || a.y !== b.y) return;
    const key = [p.id,id].sort().join('-'); if (spouses.has(key)) return; spouses.add(key);
    const left = a.x < b.x ? a : b; const right = a.x < b.x ? b : a;
    const y = left.y + SIZE*.52;
    lines.push({ key: `s-${key}`, ids: [p.id,id], kind:'spouse', path: `M ${left.x+SIZE} ${y} C ${left.x+SIZE+28} ${y} ${right.x-28} ${y} ${right.x} ${y}` });
  }));
  const lovers=new Set<string>();
  people.forEach(p=>p.loverIds.forEach(id=>{
    const a=positions.get(p.id),b=positions.get(id);
    if(!a||!b)return;
    const key=[p.id,id].sort().join('-');
    if(lovers.has(key))return;
    lovers.add(key);
    const left=a.x<b.x?a:b,right=a.x<b.x?b:a;
    const y=left.y+SIZE*.52;
    lines.push({key:`l-${key}`,ids:[p.id,id],kind:'lover',path:`M ${left.x+SIZE} ${y} C ${left.x+SIZE+30} ${y-23} ${right.x-30} ${right.y+SIZE*.52-23} ${right.x} ${right.y+SIZE*.52}`});
  }));
  const groups = new Map<string, Person[]>();
  people.forEach(child => {
    const parents = child.parentIds.filter(id => byId.has(id)).sort();
    if (!parents.length) return;
    const key = parents.join('|'); groups.set(key, [...(groups.get(key)||[]), child]);
  });
  groups.forEach((children,key) => {
    const parents = key.split('|');
    const parentPts = parents.map(id => positions.get(id)).filter((x): x is Point => !!x);
    if (!parentPts.length) return;
    const startX = parentPts.reduce((sum,p)=>sum+p.x+SIZE/2,0)/parentPts.length;
    const startY = Math.max(...parentPts.map(p=>p.y))+SIZE+14;
    children.forEach(child => {
      const target = positions.get(child.id); if (!target) return;
      const endX = target.x+SIZE/2; const endY = target.y-13;
      const bend = Math.min(110, Math.max(55, (endY-startY)*.48));
      lines.push({ key: `c-${key}-${child.id}`, ids: [...parents,child.id], kind:'parent', path: `M ${startX} ${startY} C ${startX} ${startY+bend} ${endX} ${endY-bend} ${endX} ${endY}` });
    });
  });
  return { positions, width, height: (maxDepth+1)*ROW+85, lines, generations:people.length?Array.from({length:maxDepth+1},(_,i)=>82+i*ROW):[] };
}

export function Portrait({ person, className = '' }: { person: Person; className?: string }) {
  return <span className={`portrait-outer ${className}`}><span className="portrait-border"/><span className="portrait-inner"><PortraitImage src={person.portrait} alt={person.name}/></span><svg className="portrait-contours" viewBox="0 0 164 188.6" preserveAspectRatio="none" aria-hidden="true"><path className="contour-outer" d="M82 1 L154 36 L154 149 L82 187 L10 149 L10 36 Z"/><path className="contour-inner" d="M82 5 L150 39 L150 146 L82 183 L14 146 L14 39 Z"/><path className="contour-crown" d="M10 36 L82 1 L154 36"/></svg></span>;
}

export function TreeCanvas({ people, selectedId, onSelect, preview = false, years = true, density = 'comfortable' }: { people: Person[]; selectedId?: string | null; onSelect: (id: string) => void; preview?: boolean; years?: boolean; density?: 'comfortable' | 'compact' }) {
  const layout = useMemo(() => makeLayout(people,density), [people,density]);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const moved = useRef(false);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [transform, setTransform] = useState(transformRef.current);
  const related = useMemo(() => { const selected=people.find(p=>p.id===selectedId); return selected ? relativesOf(people, selected) : new Set<string>(); }, [people, selectedId]);
  const update = (next: typeof transform) => { transformRef.current = next; setTransform(next); };
  const fit = useCallback((comfortable = false) => {
    const el = viewport.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const allScale = Math.min(preview ? 1 : 1.08, (w-50)/layout.width, (h-35)/layout.height);
    const scale = comfortable && !preview ? Math.max(w < 800 ? .66 : .8, allScale) : allScale;
    update({ scale, x: (w-layout.width*scale)/2, y: comfortable && !preview && scale > allScale ? 5 : (h-layout.height*scale)/2 });
  }, [layout, preview]);
  useEffect(() => { fit(true); const observer = new ResizeObserver(() => fit(true)); if (viewport.current) observer.observe(viewport.current); return () => observer.disconnect(); }, [fit]);
  const zoom = (factor: number, center?: Point) => {
    const el = viewport.current; if (!el) return;
    const rect = el.getBoundingClientRect(); const c = center || { x: rect.width/2, y: rect.height/2 };
    const t = transformRef.current; const scale = Math.min(2.2,Math.max(.25,t.scale*factor));
    update({ scale, x: c.x-(c.x-t.x)*scale/t.scale, y: c.y-(c.y-t.y)*scale/t.scale });
  };
  const focus = (id: string) => { const el=viewport.current, p=layout.positions.get(id); if (!el||!p) return; const t=transformRef.current; update({ ...t, x: el.clientWidth*.47-(p.x+SIZE/2)*t.scale, y: el.clientHeight*.48-(p.y+SIZE/2)*t.scale }); };
  useEffect(() => { if (selectedId && !preview) focus(selectedId); }, [selectedId, preview]);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { if (preview || (e.target as HTMLElement).closest('.tree-person')) return; viewport.current?.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved.current=false; };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const old = pointers.current.get(e.pointerId)!; const next = {x:e.clientX,y:e.clientY}; const all = Array.from(pointers.current.entries());
    if (Math.abs(next.x-old.x)+Math.abs(next.y-old.y)>2) moved.current=true;
    if (all.length===1) { const t=transformRef.current; update({...t,x:t.x+next.x-old.x,y:t.y+next.y-old.y}); }
    else if (all.length===2) {
      const other = all.find(([id])=>id!==e.pointerId)![1]; const oldDist=Math.hypot(old.x-other.x,old.y-other.y); const newDist=Math.hypot(next.x-other.x,next.y-other.y);
      const rect=viewport.current!.getBoundingClientRect(); zoom(newDist/Math.max(1,oldDist),{x:(next.x+other.x)/2-rect.left,y:(next.y+other.y)/2-rect.top});
    }
    pointers.current.set(e.pointerId,next);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => pointers.current.delete(e.pointerId);
  return <div className={`tree-viewport ${preview?'tree-preview':''}`} ref={viewport} onDragStart={e=>e.preventDefault()} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={e=>{if(preview)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();zoom(e.deltaY<0?1.1:.91,{x:e.clientX-rect.left,y:e.clientY-rect.top});}}>
    <div className="tree-stage" style={{width:layout.width,height:layout.height,transform:`translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`}}>
      <svg className="tree-lines" width={layout.width} height={layout.height} aria-hidden="true"><g>{layout.lines.map(line=><path key={line.key} d={line.path} className={`${line.kind==='lover'?'line-lover':''} ${selectedId ? (line.ids.includes(selectedId)?'line-active':'line-dim') : ''}`} />)}</g></svg>
      {!preview&&layout.generations.map((y,i)=><span key={i} className="generation-label" style={{top:y+72}}>{String(i+1).padStart(2,'0')} <i/> 世代</span>)}
      {people.map(p=>{const point=layout.positions.get(p.id);if(!point)return null;return <button type="button" key={p.id} className={`tree-person ${selectedId && selectedId!==p.id && !related.has(p.id)?'person-dim':''} ${selectedId===p.id?'person-active':''}`} style={{left:point.x,top:point.y}} onClick={()=>{if(!moved.current)onSelect(p.id);moved.current=false;}} aria-label={`查看 ${p.name}`}><Portrait person={p}/><span className="tree-person-name">{p.name}</span>{years&&<span className="tree-person-years">{yearsOf(p)}</span>}</button>})}
    </div>
    {!preview && <div className="canvas-controls"><button onClick={()=>zoom(1.2)} aria-label="放大">＋</button><button onClick={()=>zoom(.83)} aria-label="缩小">−</button><button onClick={()=>fit(false)} aria-label="适合画布">⊞</button></div>}
    {!preview && <span className="canvas-hint">拖动浏览 · 滚轮缩放 · 点击肖像查看档案</span>}
  </div>;
}

export function relationshipNames(people: Person[], p: Person) {
  return { parents: p.parentIds.map(id=>people.find(x=>x.id===id)).filter((x):x is Person=>!!x), spouses: p.spouseIds.map(id=>people.find(x=>x.id===id)).filter((x):x is Person=>!!x), lovers: p.loverIds.map(id=>people.find(x=>x.id===id)).filter((x):x is Person=>!!x), children: childrenOf(people,p.id) };
}
