import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';

export function FeaturedTreePicker({onClose}:{onClose:()=>void}) {
  const {data,setFeaturedTree}=useStore();
  const dialog=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState('');
  const [worldId,setWorldId]=useState('all');
  useEffect(()=>{dialog.current?.showModal();dialog.current?.querySelector('input')?.focus();},[]);
  const worlds=new Map(data.worlds.map(world=>[world.id,world.name]));
  const counts=new Map<string,number>();
  data.people.forEach(person=>counts.set(person.treeId,(counts.get(person.treeId)||0)+1));
  const search=query.trim().toLocaleLowerCase();
  const trees=data.trees.filter(tree=>(worldId==='all'||tree.worldId===worldId)&&`${tree.name} ${worlds.get(tree.worldId)||''}`.toLocaleLowerCase().includes(search));

  return <dialog ref={dialog} className="featured-picker" aria-labelledby="featured-picker-title" onCancel={onClose} onClick={event=>{
    if(event.target!==event.currentTarget)return;
    const rect=event.currentTarget.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();
  }}>
    <header><h2 id="featured-picker-title">选择家谱</h2><button className="icon-button" onClick={onClose} aria-label="关闭家谱选择">×</button></header>
    <div className="featured-picker-filters"><input autoFocus type="search" aria-label="搜索展示家谱" placeholder="搜索家族或世界线" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="筛选展示家谱的世界线" value={worldId} onChange={event=>setWorldId(event.target.value)}><option value="all">所有世界线</option>{data.worlds.map(world=><option key={world.id} value={world.id}>{world.name}</option>)}</select></div>
    <div className="featured-picker-list">{trees.map(tree=><button key={tree.id} className={data.featuredTreeId===tree.id?'is-featured':''} aria-pressed={data.featuredTreeId===tree.id} onClick={()=>{setFeaturedTree(tree.id);onClose();}}><img src={tree.cover||'/assets/archive-court.jpg'} alt=""/><span><strong>{tree.name}</strong><small>{worlds.get(tree.worldId)} · {counts.get(tree.id)||0} 位人物{tree.isDemo?' · 示例':''}</small></span><b aria-hidden="true">{data.featuredTreeId===tree.id?'✓':''}</b></button>)}{trees.length===0&&<p className="featured-picker-empty">没有找到家谱。</p>}</div>
  </dialog>;
}
