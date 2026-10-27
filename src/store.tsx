import { createContext, useContext, type ReactNode } from 'react';
import { initialData, resolveFeaturedTree, type ArchiveData, type ArchiveItem, type FamilyTree, type Person, type World } from './data';
import { useAuth } from './auth';
import { readLegacy, useArchivePersistence } from './persistence';

const uid=()=>globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
type PersonDraft=Omit<Person,'id'> & {id?:string;childIds:string[]};
type Store={
  data:ArchiveData;
  saveStatus:string;
  saveStatusText:string;
  saveFailure:string;
  ready:boolean;
  canEdit:boolean;
  hasPending:boolean;
  retrySync:()=>Promise<void>;
  reloadCloud:()=>void;
  migrateLocal:()=>void;
  saveWorld:(world:Omit<World,'id'> & {id?:string})=>string;
  deleteWorld:(id:string)=>void;
  setActiveWorld:(id:string)=>void;
  setFeaturedTree:(id:string)=>void;
  saveTree:(tree:Omit<FamilyTree,'id'> & {id?:string})=>string;
  deleteTree:(id:string)=>void;
  savePerson:(draft:PersonDraft)=>string;
  deletePerson:(id:string)=>void;
  saveItem:(item:Omit<ArchiveItem,'id'> & {id?:string})=>string;
  deleteItem:(id:string)=>void;
  setPreference:<K extends keyof ArchiveData['preferences']>(key:K,value:ArchiveData['preferences'][K])=>void;
  importData:(value:unknown)=>void;
  resetDemo:()=>void;
};
const Context=createContext<Store|null>(null);
const unique=(ids:string[])=>[...new Set(ids)];

export function prepare(value:unknown):ArchiveData {
  if(!value||typeof value!=='object')throw new Error('数据文件格式不正确。');
  const raw=value as Record<string,unknown>;
  if((raw.version!==1&&raw.version!==2&&raw.version!==3)||!Array.isArray(raw.trees)||!Array.isArray(raw.people)||!Array.isArray(raw.items))throw new Error('数据版本不受支持。');
  let trees=raw.trees as FamilyTree[],people=raw.people as Person[],items=raw.items as ArchiveItem[];
  const worlds:World[]=raw.version===3&&Array.isArray(raw.worlds)?raw.worlds as World[]:[...initialData.worlds];
  if(raw.version===1){
    trees=[...trees.filter(t=>!t.isDemo&&t.id!=='tree-shen'),...initialData.trees];
    people=[...people.filter(p=>p.treeId!=='tree-shen'),...initialData.people];
    items=[...items.filter(i=>!i.isDemo),...initialData.items];
  }
  if(raw.version!==3)trees=trees.map(t=>({...t,worldId:'world-demo'}));
  trees=trees.map(t=>t.isDemo&&t.cover?.startsWith('/assets/medieval-')?{...t,cover:initialData.trees.find(d=>d.id===t.id)?.cover||t.cover}:t);
  people=people.map(p=>({...p,portrait:/^medieval:([1-9])$/.test(p.portrait)?`/assets/portrait-art-${p.portrait.slice(-1)}.jpg`:p.portrait,biography:p.biography?.includes('这是一份虚构的中世纪家族记录')?p.summary:p.biography,notes:p.notes==='虚构示例人物。'?'':p.notes,parentIds:unique(p.parentIds||[]),spouseIds:unique(p.spouseIds||[]),loverIds:unique(p.loverIds||[])}));
  items=items.map(i=>i.isDemo&&i.image?.startsWith('/assets/medieval-')?{...i,image:initialData.items.find(d=>d.id===i.id)?.image||i.image}:i);
  if(!trees.every(t=>typeof t.id==='string'&&typeof t.name==='string')||!people.every(p=>typeof p.id==='string'&&typeof p.treeId==='string'&&Array.isArray(p.parentIds)&&Array.isArray(p.spouseIds)&&Array.isArray(p.loverIds))||!items.every(i=>typeof i.id==='string'&&Array.isArray(i.personIds)))throw new Error('数据记录缺少必要字段。');
  const worldIds=new Set(worlds.map(w=>w.id)),treeIds=new Set(trees.map(t=>t.id)),byId=new Map(people.map(p=>[p.id,p])),treeById=new Map(trees.map(t=>[t.id,t]));
  if(!worlds.length||!worlds.every(w=>typeof w.id==='string'&&typeof w.name==='string')||!trees.every(t=>worldIds.has(t.worldId)))throw new Error('世界线记录无效。');
  if(worldIds.size!==worlds.length||treeIds.size!==trees.length||byId.size!==people.length)throw new Error('存在重复的记录编号。');
  if(people.some(p=>!treeIds.has(p.treeId)||[...p.parentIds,...p.spouseIds,...p.loverIds].some(id=>id===p.id||!byId.has(id))))throw new Error('人物关系引用无效。');
  if(people.some(p=>[...p.parentIds,...p.spouseIds,...p.loverIds].some(id=>treeById.get(byId.get(id)!.treeId)?.worldId!==treeById.get(p.treeId)?.worldId)))throw new Error('不同世界线的人物不能建立关系。');
  if(people.some(p=>p.spouseIds.some(id=>!byId.get(id)?.spouseIds.includes(p.id))||p.loverIds.some(id=>!byId.get(id)?.loverIds.includes(p.id))))throw new Error('双向关系不完整。');
  if(items.some(i=>i.personIds.some(id=>!byId.has(id))))throw new Error('档案引用了不存在的人物。');
  const visiting=new Set<string>(),visited=new Set<string>();
  const cycle=(id:string):boolean=>{
    if(visiting.has(id))return true;
    if(visited.has(id))return false;
    visiting.add(id);
    if(byId.get(id)!.parentIds.some(cycle))return true;
    visiting.delete(id);visited.add(id);return false;
  };
  if(people.some(p=>cycle(p.id)))throw new Error('父母关系形成循环。');
  const preferences=raw.preferences as ArchiveData['preferences']|undefined;
  const activeWorldId=typeof raw.activeWorldId==='string'&&worldIds.has(raw.activeWorldId)?raw.activeWorldId:worlds[0].id;
  const featuredTreeId=resolveFeaturedTree(trees,typeof raw.featuredTreeId==='string'?raw.featuredTreeId:null)?.id||null;
  return {version:3,worlds,activeWorldId,featuredTreeId,trees,people,items,preferences:{texture:preferences?.texture!==false,years:preferences?.years!==false,motion:preferences?.motion!==false,accent:['moss','silver','wine','copper'].includes(preferences?.accent||'')?preferences!.accent:'moss',density:preferences?.density==='compact'?'compact':'comfortable',portraitFrame:preferences?.portraitFrame==='single'?'single':'crest'}};
}

export function StoreProvider({children}:{children:ReactNode}) {
  const {user,configured}=useAuth();
  const {data,setData,status,statusText,ready,failure,retry,reloadCloud,hasPending}=useArchivePersistence(user?.id||null,prepare);
  const canEdit=!configured||!!user;
  const migrateLocal=()=>{
    try {
      const existing=readLegacy(prepare);
      if(!existing){alert('没有找到待迁移的本机资料。');return;}
      if(confirm(`迁移 ${existing.worlds.length} 条世界线、${existing.trees.length} 个家族和 ${existing.people.length} 位人物到当前账户？将替换当前账户资料，已有云端版本会保留。`))setData(existing);
    } catch {alert('本机资料无法读取，原始记录已保留。');}
  };
  const saveWorld:Store['saveWorld']=draft=>{const id=draft.id||uid();setData(d=>({...d,worlds:d.worlds.some(w=>w.id===id)?d.worlds.map(w=>w.id===id?{...draft,id}:w):[...d.worlds,{...draft,id}],activeWorldId:id}));return id;};
  const deleteWorld:Store['deleteWorld']=id=>setData(d=>{
    if(d.worlds.length<=1)return d;
    const worlds=d.worlds.filter(w=>w.id!==id);
    const removedTrees=new Set(d.trees.filter(t=>t.worldId===id).map(t=>t.id));
    const removedPeople=new Set(d.people.filter(p=>removedTrees.has(p.treeId)).map(p=>p.id));
    const trees=d.trees.filter(t=>!removedTrees.has(t.id));
    return {...d,worlds,activeWorldId:d.activeWorldId===id?worlds[0].id:d.activeWorldId,trees,featuredTreeId:resolveFeaturedTree(trees,d.featuredTreeId)?.id||null,people:d.people.filter(p=>!removedPeople.has(p.id)),items:d.items.map(item=>({...item,personIds:item.personIds.filter(pid=>!removedPeople.has(pid))}))};
  });
  const setActiveWorld:Store['setActiveWorld']=id=>setData(d=>d.worlds.some(w=>w.id===id)?{...d,activeWorldId:id}:d);
  const setFeaturedTree:Store['setFeaturedTree']=id=>setData(d=>d.trees.some(t=>t.id===id)?{...d,featuredTreeId:id}:d);
  const saveTree:Store['saveTree']=draft=>{
    const id=draft.id||uid(),tree={...draft,id};
    setData(d=>{const trees=d.trees.some(t=>t.id===id)?d.trees.map(t=>t.id===id?tree:t):[...d.trees,tree];return {...d,trees,featuredTreeId:resolveFeaturedTree(trees,d.featuredTreeId)?.id||null};});
    return id;
  };
  const deleteTree:Store['deleteTree']=id=>setData(d=>{
    const removed=new Set(d.people.filter(p=>p.treeId===id).map(p=>p.id));
    const trees=d.trees.filter(t=>t.id!==id);
    return {...d,trees,featuredTreeId:resolveFeaturedTree(trees,d.featuredTreeId)?.id||null,people:d.people.filter(p=>!removed.has(p.id)).map(p=>({...p,parentIds:p.parentIds.filter(x=>!removed.has(x)),spouseIds:p.spouseIds.filter(x=>!removed.has(x)),loverIds:p.loverIds.filter(x=>!removed.has(x))})),items:d.items.map(i=>({...i,personIds:i.personIds.filter(x=>!removed.has(x))}))};
  });
  const savePerson:Store['savePerson']=draft=>{
    const id=draft.id||uid();
    const {childIds,...rest}=draft;
    setData(d=>{
      const worldId=d.trees.find(t=>t.id===rest.treeId)?.worldId;
      const valid=new Set(d.people.filter(p=>d.trees.find(t=>t.id===p.treeId)?.worldId===worldId).map(p=>p.id));
      const keep=(ids:string[])=>unique(ids.filter(x=>x!==id&&valid.has(x)));
      const parents=keep(rest.parentIds),spouses=keep(rest.spouseIds),lovers=keep(rest.loverIds),children=keep(childIds);
      const record:Person={...rest,id,parentIds:parents,spouseIds:spouses,loverIds:lovers};
      let people=d.people.some(p=>p.id===id)?d.people.map(p=>p.id===id?record:p):[...d.people,record];
      people=people.map(p=>{
        if(p.id===id)return p;
        const pair=(current:string[],selected:string[])=>selected.includes(p.id)?unique([...current,id]):current.filter(x=>x!==id);
        return {...p,spouseIds:pair(p.spouseIds,spouses),loverIds:pair(p.loverIds,lovers),parentIds:pair(p.parentIds,children)};
      });
      return {...d,people};
    });
    return id;
  };
  const deletePerson:Store['deletePerson']=id=>setData(d=>({...d,people:d.people.filter(p=>p.id!==id).map(p=>({...p,parentIds:p.parentIds.filter(x=>x!==id),spouseIds:p.spouseIds.filter(x=>x!==id),loverIds:p.loverIds.filter(x=>x!==id)})),items:d.items.map(i=>({...i,personIds:i.personIds.filter(x=>x!==id)}))}));
  const saveItem:Store['saveItem']=draft=>{const id=draft.id||uid(),item={...draft,id};setData(d=>({...d,items:d.items.some(i=>i.id===id)?d.items.map(i=>i.id===id?item:i):[...d.items,item]}));return id;};
  const deleteItem:Store['deleteItem']=id=>setData(d=>({...d,items:d.items.filter(i=>i.id!==id)}));
  const setPreference:Store['setPreference']=(key,value)=>setData(d=>({...d,preferences:{...d.preferences,[key]:value}}));
  const importData:Store['importData']=value=>setData(prepare(value));
  const resetDemo=()=>setData(d=>{
    const demo=new Set(d.trees.filter(t=>t.isDemo).map(t=>t.id));
    const removed=new Set(d.people.filter(p=>demo.has(p.treeId)).map(p=>p.id));
    const trees=[...d.trees.filter(t=>!t.isDemo),...initialData.trees];
    return {...d,worlds:d.worlds.some(w=>w.id==='world-demo')?d.worlds:[...d.worlds,...initialData.worlds],trees,featuredTreeId:resolveFeaturedTree(trees,d.featuredTreeId)?.id||null,people:[...d.people.filter(p=>!removed.has(p.id)).map(p=>({...p,parentIds:p.parentIds.filter(x=>!removed.has(x)),spouseIds:p.spouseIds.filter(x=>!removed.has(x)),loverIds:p.loverIds.filter(x=>!removed.has(x))})),...initialData.people],items:[...d.items.filter(i=>!i.isDemo).map(i=>({...i,personIds:i.personIds.filter(x=>!removed.has(x))})),...initialData.items]};
  });
  return <Context.Provider value={{data,saveStatus:status,saveStatusText:statusText,saveFailure:failure,ready,canEdit,hasPending,retrySync:retry,reloadCloud,migrateLocal,saveWorld,deleteWorld,setActiveWorld,setFeaturedTree,saveTree,deleteTree,savePerson,deletePerson,saveItem,deleteItem,setPreference,importData,resetDemo}}>{children}</Context.Provider>;
}
export function useStore(){const store=useContext(Context);if(!store)throw new Error('Store missing');return store;}
