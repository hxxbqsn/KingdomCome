import { useState } from 'react';
import { resolveFeaturedTree, visiblePeopleForTree, yearsOf } from './data';
import { useStore } from './store';
import { TreeCanvas } from './TreeCanvas';
import { PortraitImage } from './PortraitImage';
import { FeaturedTreePicker } from './FeaturedTreePicker';

function HomeSectionHeading({ number, title, action, onAction }: { number:string; title:string; action:string; onAction:()=>void }) {
  return <header className="home-section-heading"><span className="home-section-number">{number}</span><div><h2>{title}</h2></div><button className="text-action" onClick={onAction}>{action} <span aria-hidden="true">↗</span></button></header>;
}

export function Home({go}:{go:(path:string)=>void}) {
  const {data,setActiveWorld}=useStore();
  const [choosing,setChoosing]=useState(false);
  const trees=data.trees.filter(t=>t.worldId===data.activeWorldId);
  const treeIds=new Set(trees.map(t=>t.id));
  const worldPeople=data.people.filter(p=>treeIds.has(p.treeId));
  const world=data.worlds.find(w=>w.id===data.activeWorldId);
  const featured=resolveFeaturedTree(data.trees,data.featuredTreeId);
  const featuredWorld=data.worlds.find(w=>w.id===featured?.worldId);
  const featuredWorldTreeIds=new Set(data.trees.filter(t=>t.worldId===featured?.worldId).map(t=>t.id));
  const featuredWorldPeople=data.people.filter(p=>featuredWorldTreeIds.has(p.treeId));
  const featuredPeople=featuredWorldPeople.filter(p=>p.treeId===featured?.id);
  const people=featured?visiblePeopleForTree(featuredWorldPeople,featured.id).slice(0,7):[];
  const featuredCount=featuredPeople.length;
  const openFeatured=(path:string)=>{if(featured)setActiveWorld(featured.worldId);go(path);};
  return <main className="archive-home page-enter">
    <section className="archive-opening">
      <div className="opening-meta"><span>家族 / 人物 / 记录</span><span>{world?.name}</span></div>
      <div className="opening-heading">
        <div><span className="opening-wordmark">KINGDOM COME</span><h1 className="desktop-archive-title">家族档案</h1></div>
        <div className="opening-aside"><span>谱系索引</span><span>{String(trees.length).padStart(2,'0')} 份家谱<br/>{String(worldPeople.length).padStart(2,'0')} 位人物</span></div>
      </div>
      <div className="opening-links"><button onClick={()=>go('/trees')}>浏览家谱 <span aria-hidden="true">↗</span></button><button onClick={()=>go('/people')}>查找人物 <span aria-hidden="true">↗</span></button></div>
      <div className="archive-collage">
        <div className="collage-sheet collage-sheet-back"><img src="/assets/archive-marriage.jpg" alt="大都会艺术博物馆藏中世纪婚礼手稿" width="408" height="625" draggable={false}/></div>
        <div className="collage-sheet collage-sheet-front"><img src="/assets/archive-manuscript.jpg" alt="大都会艺术博物馆藏祈祷书页" width="472" height="624" draggable={false}/></div>
        <button className="collage-primary" onClick={()=>go('/trees')} aria-label="浏览家族谱系"><img src="/assets/archive-court.jpg" alt="大都会艺术博物馆藏宫廷题材织物" width="599" height="503" fetchPriority="high" draggable={false}/><span>馆藏图像 / 宫廷场景</span></button>
        <button className="collage-caption" onClick={()=>openFeatured(featured?`/trees/${featured.id}`:'/trees')}><small>精选家谱</small><strong>{featured?.name||'创建家谱'}</strong><span>{featured?`${featuredCount} 位人物`:'开始记录'} <b aria-hidden="true">↗</b></span></button>
      </div>
    </section>
    <div className={`home-archive-sections${featured?'':' home-archive-sections-empty'}`}>
    {featured&&<section className="home-tree-section">
      <HomeSectionHeading number="01" title="家族谱系" action="浏览全部家谱" onAction={()=>go('/trees')}/>
      <div className="home-featured-layout"><div className="home-tree-copy"><div className="home-featured-heading"><span className="home-section-label">精选家谱</span><button className="text-action" onClick={()=>setChoosing(true)}>更换 <span aria-hidden="true">↗</span></button></div><h3>{featured.name}</h3><p>{featured.description||featuredWorld?.name}</p><span className="home-tree-count">{String(featuredCount).padStart(2,'0')} 位人物</span><button className="text-action" onClick={()=>openFeatured(`/trees/${featured.id}`)}>打开家谱 ↗</button></div>
        <div className="home-tree-preview">{people.length>0&&<TreeCanvas people={people} preview years={data.preferences.years} density={data.preferences.density} onSelect={()=>openFeatured(`/trees/${featured.id}`)}/>}</div>
      </div>
    </section>}
    <section className="home-index"><HomeSectionHeading number={featured?'02':'01'} title="人物名册" action="查看全部人物" onAction={()=>openFeatured(featured?`/people?tree=${encodeURIComponent(featured.id)}`:'/people')}/><div className="home-index-portraits">{featuredPeople.slice(0,4).map((p,i)=><button key={p.id} onClick={()=>openFeatured(`/people/${p.id}`)} aria-label={`查看${p.name}的人物档案`}><span className="home-index-photo"><PortraitImage src={p.portrait} alt={p.name}/></span><span className="home-index-caption"><small>{String(i+1).padStart(2,'0')}</small><strong>{p.name}</strong>{data.preferences.years&&<em>{yearsOf(p)}</em>}</span></button>)}</div>{featuredPeople.length===0&&<button className="home-empty-index" onClick={()=>openFeatured(featured?`/trees/${featured.id}`:'/trees')}>{featured?'这份家谱尚无人物':'创建家谱'} <span aria-hidden="true">↗</span></button>}</section>
    </div>
    {choosing&&<FeaturedTreePicker onClose={()=>setChoosing(false)}/>}
  </main>;
}
