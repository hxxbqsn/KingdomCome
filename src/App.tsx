import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { childrenOf, visiblePeopleForTree, wouldCreateCycle, yearsOf, type ArchiveItem, type FamilyTree, type Person, type World } from './data';
import { useStore } from './store';
import { TreeCanvas, relationshipNames } from './TreeCanvas';
import { PortraitImage } from './PortraitImage';
import { Home } from './Home';
import { PortraitCropper } from './PortraitCropper';
import { useAuth } from './auth';
import { AccountSettings, LoginPage } from './Account';

const navItems = [['/', '首页'], ['/trees', '家谱'], ['/people', '人物']];
const readImage = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
const label = (text: string) => <span className="eyebrow">{text}</span>;
const coverOptions = [
  ['/assets/archive-court.jpg','宫廷织物'],
  ['/assets/archive-marriage.jpg','婚礼手稿'],
  ['/assets/archive-manuscript.jpg','祈祷书页'],
  ['/assets/archive-family.jpg','家族群像'],
  ['/assets/archive-courtyard.jpg','庭院素描'],
  ['/assets/archive-letter.jpg','古籍手稿'],
  ['/assets/cover-arthur.jpg','亚瑟王织物'],
  ['/assets/cover-rose-garden.jpg','玫瑰园织物'],
  ['/assets/cover-charlemagne.jpg','查理曼织物']
] as const;

function subscribeRoute(update:()=>void) {
  addEventListener('popstate',update);
  return()=>removeEventListener('popstate',update);
}
function navigateTo(next:string) {
  if(location.pathname+location.search!==next){history.pushState({},'',next);dispatchEvent(new PopStateEvent('popstate'));}
  window.scrollTo(0,0);
}
function useRoute() {
  const route=useSyncExternalStore(subscribeRoute,()=>location.pathname+location.search);
  const query=route.indexOf('?');
  return {path:query<0?route:route.slice(0,query),search:query<0?'':route.slice(query),go:navigateTo};
}

function ImageUpload({ value, onChange, title='更换图片' }: {value:string;onChange:(url:string)=>void;title?:string}) {
  const ref=useRef<HTMLInputElement>(null);
  return <div className="image-upload"><div className="image-upload-preview">{value&&<PortraitImage src={value} alt="已选择的图片"/>}</div><button type="button" className="text-action" onClick={()=>ref.current?.click()}>{title} ↗</button><input ref={ref} type="file" accept="image/*" hidden onChange={async e=>{const file=e.target.files?.[0];if(file){onChange(await readImage(file));e.target.value='';}}}/></div>;
}

function Modal({ title, onClose, children, wide=false }: {title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head">{label('编辑记录')}<button className="icon-button" onClick={onClose} aria-label="关闭">×</button></div><h2>{title}</h2>{children}</div></div>;
}

function LoginRequired({onClose}:{onClose:()=>void}) {
  return <Modal title="登录" onClose={onClose}><button className="primary-action" onClick={()=>{onClose();dispatchEvent(new Event('kingdom-login-required'));}}>登录后继续 ↗</button></Modal>;
}

function TreeEditor({ tree, onClose, onDone }: {tree?:FamilyTree;onClose:()=>void;onDone:(id:string)=>void}) {
  const {data,saveTree,deleteTree,canEdit}=useStore();
  const [name,setName]=useState(tree?.name||''); const [description,setDescription]=useState(tree?.description||''); const [cover,setCover]=useState(tree?.cover||'/assets/archive-court.jpg');
  const submit=(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;const id=saveTree({id:tree?.id,worldId:tree?.worldId||data.activeWorldId,name:name.trim(),subtitle:'',description:description.trim(),cover,isDemo:tree?.isDemo||false});onDone(id);};
  if(!canEdit)return <LoginRequired onClose={onClose}/>;
  return <Modal title={tree?'编辑家谱':'创建家谱'} onClose={onClose}><form className="editor-form" onSubmit={submit}><div className="tree-editor-cover"><ImageUpload value={cover} onChange={setCover} title="上传自己的封面"/><div className="cover-library"><span>选择馆藏封面</span><div>{coverOptions.map(([url,title])=><button type="button" key={url} className={cover===url?'selected':''} aria-label={`选择${title}`} aria-pressed={cover===url} title={title} onClick={()=>setCover(url)}><img src={url} alt="" loading="lazy"/></button>)}</div></div></div><label>家谱名称<input required value={name} onChange={e=>setName(e.target.value)} placeholder="例如：北境家族"/></label><label>简介<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="写下这份家谱的故事"/></label><div className="form-actions"><button className="primary-action" type="submit">保存家谱 ↗</button>{tree&&<button type="button" className="danger-action" onClick={()=>{if(confirm(`确定删除“${tree.name}”及其中所有人物吗？此操作无法撤销。`)){deleteTree(tree.id);onClose();}}}>删除家谱</button>}</div></form></Modal>;
}

function MultiRelation({ title, choices, values, setValues }: {title:string;choices:Person[];values:string[];setValues:(ids:string[])=>void}) {
  const {data}=useStore();
  const [query,setQuery]=useState('');
  const [house,setHouse]=useState('all');
  const [open,setOpen]=useState(false);
  const selected=values.map(id=>data.people.find(p=>p.id===id)).filter((p):p is Person=>!!p);
  const results=choices.filter(p=>(house==='all'||p.treeId===house)&&p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,40);
  return <fieldset className="relation-picker"><legend>{title} <small>{values.length ? `· ${values.length} 位` : ''}</small></legend>
    {selected.length>0&&<div className="relation-selected">{selected.map(p=><button key={p.id} type="button" onClick={()=>setValues(values.filter(id=>id!==p.id))} title={`移除 ${p.name}`}>{p.name} ×</button>)}</div>}
    <div className="relation-search-row"><input aria-label={`搜索${title}`} value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} placeholder="输入姓名查找…"/><select aria-label={`按家族筛选${title}`} value={house} onChange={e=>{setHouse(e.target.value);setOpen(true);}}><option value="all">所有家族</option>{data.trees.filter(t=>t.worldId===data.activeWorldId).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div>
    <button className="relation-browse" type="button" onClick={()=>setOpen(!open)}>{open?'收起人物':'浏览人物'} <span>{open?'⌃':'⌄'}</span></button>
    {open&&<div className="relation-options">{results.length?results.map(p=><button className={values.includes(p.id)?'chosen':''} type="button" key={p.id} onClick={()=>setValues(values.includes(p.id)?values.filter(id=>id!==p.id):[...values,p.id])}><PortraitImage src={p.portrait} alt=""/><span><strong>{p.name}</strong><small>{data.trees.find(t=>t.id===p.treeId)?.name} · {yearsOf(p)}</small></span><b>{values.includes(p.id)?'✓':'＋'}</b></button>):<p className="muted small">没有匹配的人物。</p>}</div>}
    {open&&choices.length>40&&<p className="muted small">显示前 40 位；可输入姓名继续查找。</p>}
  </fieldset>;
}

function PersonEditor({ person, treeId, onClose, onDone, onDeleted }: {person?:Person;treeId:string;onClose:()=>void;onDone:(id:string)=>void;onDeleted?:()=>void}) {
  const {data,savePerson,deletePerson,canEdit}=useStore(); const worldTrees=data.trees.filter(t=>t.worldId===data.activeWorldId);const worldTreeIds=new Set(worldTrees.map(t=>t.id));const others=data.people.filter(p=>p.id!==person?.id&&worldTreeIds.has(p.treeId));
  const [name,setName]=useState(person?.name||'');const [house,setHouse]=useState(person?.treeId||treeId);const [born,setBorn]=useState(person?.born||'');const [died,setDied]=useState(person?.died||'');const [gender,setGender]=useState(person?.gender||'未记录');const [portrait,setPortrait]=useState(person?.portrait||'/assets/portrait-placeholder.svg');const [portraitOriginal,setPortraitOriginal]=useState(person?.portraitOriginal||person?.portrait||'');const [cropSource,setCropSource]=useState<string|null>(null);const portraitFile=useRef<HTMLInputElement>(null);const [summary,setSummary]=useState(person?.summary||'');const [biography,setBiography]=useState(person?.biography||'');const [notes,setNotes]=useState(person?.notes||'');const [parents,setParents]=useState(person?.parentIds||[]);const [spouses,setSpouses]=useState(person?.spouseIds||[]);const [lovers,setLovers]=useState(person?.loverIds||[]);const [children,setChildren]=useState(person?childrenOf(data.people,person.id).map(p=>p.id):[]);
  const [section,setSection]=useState<'identity'|'relations'|'story'>('identity');
  const submit=(e:FormEvent)=>{e.preventDefault();
    if(!name.trim()){setSection('identity');return;}
    const roles=[...parents,...spouses,...lovers,...children];
    if(new Set(roles).size!==roles.length){alert('同一人物不能同时被设为父母、配偶、情人或子女。');return;}
    if(wouldCreateCycle(data.people,person?.id||'__new_person__',parents,children)){alert('这项亲属关系会形成循环，请重新选择。');return;}
    const id=savePerson({id:person?.id,treeId:house,name:name.trim(),born:born.trim(),died:died.trim(),gender,portrait,portraitOriginal,summary:summary.trim(),biography:biography.trim(),notes:notes.trim(),parentIds:parents,spouseIds:spouses,loverIds:lovers,childIds:children});onDone(id);};
  if(!canEdit)return <LoginRequired onClose={onClose}/>;
  return <Modal title={person?'编辑人物档案':'添加人物'} onClose={onClose} wide>
    <form className="editor-form person-form" onSubmit={submit}>
      <div className="person-editor-layout">
        <aside className="person-editor-aside">
          <div className="image-upload"><div className="image-upload-preview"><PortraitImage src={portrait} alt="当前肖像"/></div><button type="button" className="text-action" onClick={()=>portraitFile.current?.click()}>{person?'更换肖像':'上传肖像'} ↗</button><input ref={portraitFile} type="file" accept="image/*" hidden onChange={async e=>{const file=e.target.files?.[0];if(file)setCropSource(await readImage(file));e.target.value='';}}/>{portraitOriginal&&person&&<button type="button" className="text-action" onClick={()=>setCropSource(portraitOriginal)}>重新裁剪 ↗</button>}</div>
          <div className="person-editor-aside-copy"><span>人物档案</span><strong>{name.trim()||'未命名人物'}</strong><small>{worldTrees.find(t=>t.id===house)?.name||'选择家族'}</small></div>
        </aside>
        <div className="person-editor-main">
          <div className="person-editor-tabs" role="tablist" aria-label="档案内容">
            {([['identity','身份资料'],['relations','人物关系'],['story','生平记录']] as const).map(([key,title],index)=><button key={key} type="button" role="tab" aria-selected={section===key} className={section===key?'active':''} onClick={()=>setSection(key)}><span>0{index+1}</span>{title}</button>)}
          </div>
          <div className="person-editor-section" role="tabpanel">
            {section==='identity'&&<div className="identity-fields">
              <label className="person-name-field">姓名<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="人物姓名"/></label>
              <label>所属家族<select value={house} onChange={e=>setHouse(e.target.value)}>{worldTrees.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <div className="form-row"><label>出生年代<input value={born} onChange={e=>setBorn(e.target.value)} placeholder="例如 1372"/></label><label>逝世年代<input value={died} onChange={e=>setDied(e.target.value)} placeholder="未知可留空"/></label><label>性别<select value={gender} onChange={e=>setGender(e.target.value)}><option>未记录</option><option>男</option><option>女</option><option>其他</option></select></label></div>
              <label>简述<input value={summary} onChange={e=>setSummary(e.target.value)} placeholder="一句话介绍人物"/></label>
            </div>}
            {section==='relations'&&<div className="relation-edit-grid">
              <MultiRelation title="父母" choices={others.filter(p=>!children.includes(p.id)&&!spouses.includes(p.id)&&!lovers.includes(p.id))} values={parents} setValues={setParents}/>
              <MultiRelation title="配偶" choices={others.filter(p=>!parents.includes(p.id)&&!children.includes(p.id)&&!lovers.includes(p.id))} values={spouses} setValues={setSpouses}/>
              <MultiRelation title="情人" choices={others.filter(p=>!parents.includes(p.id)&&!children.includes(p.id)&&!spouses.includes(p.id))} values={lovers} setValues={setLovers}/>
              <MultiRelation title="子女" choices={others.filter(p=>!parents.includes(p.id)&&!spouses.includes(p.id)&&!lovers.includes(p.id))} values={children} setValues={setChildren}/>
            </div>}
            {section==='story'&&<div className="story-fields"><label>人物生平<textarea value={biography} onChange={e=>setBiography(e.target.value)} rows={8} placeholder="记录人物的经历"/></label><label>备注<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4}/></label></div>}
          </div>
        </div>
      </div>
      <div className="person-editor-actions"><span>{person?'修改人物档案':'新建人物档案'}</span><div><button className="primary-action" type="submit">保存人物 ↗</button>{person&&<button type="button" className="danger-action" onClick={()=>{if(confirm(`确定删除“${person.name}”吗？相关亲属关系也会移除。`)){deletePerson(person.id);onClose();onDeleted?.();}}}>删除人物</button>}</div></div>
    </form>{cropSource&&<PortraitCropper source={cropSource} onClose={()=>setCropSource(null)} onSave={(cropped,original)=>{setPortrait(cropped);setPortraitOriginal(original);setCropSource(null);}}/>}
  </Modal>;
}

function Header({ path, go, onSearch }: {path:string;go:(p:string)=>void;onSearch:()=>void}) {
  const {data,setActiveWorld,saveStatusText}=useStore();
  const {user}=useAuth();
  const [menu,setMenu]=useState(false);
  useEffect(()=>setMenu(false),[path]);
  return <header className="site-header"><button className="wordmark" onClick={()=>go('/')} aria-label="Kingdom Come 首页"><span className="wordmark-glyph">✦</span><span>Kingdom Come</span></button><nav className={menu?'nav-open':''} aria-label="主要导航">{navItems.map(([href,name])=><button key={href} className={path===href||href!=='/'&&path.startsWith(href)?'nav-active':''} onClick={()=>go(href)}>{name}</button>)}<label className="nav-world">世界线<select value={data.activeWorldId} onChange={e=>{setActiveWorld(e.target.value);go('/');setMenu(false);}}>{data.worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></nav><div className="header-actions">{user&&<span className="save-status header-save-status" role="status">{saveStatusText}</span>}<select className="world-switch" aria-label="切换世界线" value={data.activeWorldId} onChange={e=>{setActiveWorld(e.target.value);go('/');}}>{data.worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="header-search" onClick={onSearch}><span className="search-icon"/> <span>搜索</span></button><button className="account-entry" onClick={()=>go(user?'/settings':'/login')}>{user?.user_metadata.username|| (user?'账户':'登录')}</button><button className="icon-button settings-link" onClick={()=>go('/settings')} aria-label="设置">⚙</button><button className="icon-button menu-link" onClick={()=>setMenu(!menu)} aria-label="菜单">{menu?'×':'☰'}</button></div></header>;
}

function GlobalSearch({ onClose, go }: {onClose:()=>void;go:(p:string)=>void}) {
  const {data}=useStore();const [query,setQuery]=useState('');const worldTreeIds=new Set(data.trees.filter(t=>t.worldId===data.activeWorldId).map(t=>t.id));const results=data.people.filter(p=>worldTreeIds.has(p.treeId)&&p.name.toLowerCase().includes(query.toLowerCase())).slice(0,8);
  return <Modal title="搜索人物" onClose={onClose}><div className="search-modal"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索姓名或家族…"/><p className="eyebrow">{query?'搜索结果':'人物索引'}</p>{results.length?<div className="search-results">{results.map(p=><button key={p.id} onClick={()=>{onClose();go(`/people/${p.id}`);}}><PortraitImage src={p.portrait} alt=""/><span><strong>{p.name}</strong><small>{yearsOf(p)}</small></span><i>↗</i></button>)}</div>:<p className="muted">没有找到匹配的人物。</p>}</div></Modal>;
}

function TreesPage({go}: {go:(p:string)=>void}) {
  const {data}=useStore();const [edit,setEdit]=useState<FamilyTree|'new'|null>(null);const trees=data.trees.filter(t=>t.worldId===data.activeWorldId);
  return <main className="standard-page page-enter"><div className="page-heading">{label('家谱索引')}<div className="page-heading-row"><div><h1 className="desktop-archive-title">家族谱系</h1></div><button className="primary-action" onClick={()=>setEdit('new')}>＋ 创建家谱</button></div></div><div className="tree-list">{trees.map((tree,i)=>{const count=data.people.filter(p=>p.treeId===tree.id).length;return <article className="tree-cover" key={tree.id}><button className="tree-cover-image" onClick={()=>go(`/trees/${tree.id}`)}><img src={tree.cover||'/assets/archive-court.jpg'} alt={`${tree.name}封面`}/><span>{String(i+1).padStart(3,'0')} / 家谱</span></button><div className="tree-cover-body"><div>{tree.isDemo&&<span className="demo-tag">示例档案</span>}<h2>{tree.name}</h2><p>{tree.description||'暂无简介'}</p></div><div className="tree-cover-footer"><span>{count} 位人物</span><div><button className="text-action" onClick={()=>setEdit(tree)}>编辑</button><button className="text-action" onClick={()=>go(`/trees/${tree.id}`)}>打开家谱 ↗</button></div></div></div></article>;})}<button className="new-tree-tile" onClick={()=>setEdit('new')}><span>＋</span><strong>创建新的家族</strong><small>创建家谱</small></button></div>{edit&&<TreeEditor tree={edit==='new'?undefined:edit} onClose={()=>setEdit(null)} onDone={id=>{setEdit(null);go(`/trees/${id}`);}}/>}</main>;
}

function RelationLink({person,go}: {person:Person;go:(p:string)=>void}) {return <button className="relation-link" onClick={()=>go(`/people/${person.id}`)}><PortraitImage src={person.portrait} alt=""/><span>{person.name}<small>{yearsOf(person)}</small></span><i>↗</i></button>;}

function DetailPanel({person,people,go,onClose,onEdit}: {person:Person;people:Person[];go:(p:string)=>void;onClose:()=>void;onEdit:()=>void}) {
  const {data}=useStore();
  const rel=relationshipNames(people,person);
  return <aside className="detail-panel"><div className="detail-top">{label('人物记录 / '+person.id.toUpperCase().slice(0,8))}<button className="icon-button" onClick={onClose} aria-label="关闭详情">×</button></div><div className="detail-scroll"><PortraitImage className="detail-portrait" src={person.portrait} alt={person.name}/><h2>{person.name}</h2><p className="detail-years">{yearsOf(person)}</p><p className="detail-summary">{person.summary||'暂无简介'}</p><div className="detail-meta"><span>性别 <b>{person.gender}</b></span><span>家族 <b>{data.trees.find(t=>t.id===person.treeId)?.name||'未归属'}</b></span></div><div className="detail-relations">{(['parents','spouses','lovers','children'] as const).map((key,i)=><section key={key}><h3>{['父母','配偶','情人','子女'][i]}</h3>{rel[key].length?rel[key].map(p=><RelationLink key={p.id} person={p} go={go}/>):<p className="muted small">尚未记录</p>}</section>)}</div><div className="detail-actions"><button className="primary-action" onClick={()=>go(`/people/${person.id}`)}>查看完整档案 ↗</button><button className="text-action" onClick={onEdit}>编辑人物</button></div></div></aside>;
}

function TreePage({id,go}: {id:string;go:(p:string)=>void}) {
  const {data}=useStore();const tree=data.trees.find(t=>t.id===id);const people=visiblePeopleForTree(data.people,id);const [selected,setSelected]=useState<string|null>(null);const [edit,setEdit]=useState<Person|'new'|null>(null);const [search,setSearch]=useState('');const [showSearch,setShowSearch]=useState(false);const person=people.find(p=>p.id===selected);
  useEffect(()=>{setSelected(null);},[id]);
  if(!tree||tree.worldId!==data.activeWorldId)return <NotFound go={go}/>;
  return <main className="tree-page page-enter"><div className="tree-toolbar"><button className="back-link" onClick={()=>go('/trees')}>← <span>全部家谱</span></button><div className="tree-title">{label(tree.isDemo?'示例家谱':'家谱')}<h1>{tree.name}</h1></div><div className="tree-toolbar-actions"><button className="text-action" onClick={()=>setShowSearch(!showSearch)}>⌕ <span>查找人物</span></button><button className="primary-action" onClick={()=>setEdit('new')}>＋ 添加人物</button></div></div>{showSearch&&<div className="tree-search"><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="输入姓名查找…"/>{people.filter(p=>p.name.includes(search)).slice(0,6).map(p=><button key={p.id} onClick={()=>{setSelected(p.id);setShowSearch(false);setSearch('');}}>{p.name}<span>↗</span></button>)}</div>}<div className="tree-shell"><TreeCanvas people={people} selectedId={selected} years={data.preferences.years} density={data.preferences.density} onSelect={setSelected}/>{people.length===0&&<div className="empty-tree"><h2>故事从这里开始</h2><button className="primary-action" onClick={()=>setEdit('new')}>添加人物 ↗</button></div>}{person&&<DetailPanel person={person} people={data.people} go={go} onClose={()=>setSelected(null)} onEdit={()=>setEdit(person)}/>}</div><div className="tree-bottom"><span>{String(people.length).padStart(2,'0')} 位人物</span></div>{edit&&<PersonEditor person={edit==='new'?undefined:edit} treeId={id} onClose={()=>setEdit(null)} onDone={pid=>{setEdit(null);setSelected(pid);}} onDeleted={()=>setSelected(null)}/>}</main>;
}

function PeoplePage({go,initialTreeId='all'}: {go:(p:string)=>void;initialTreeId?:string}) {
  const {data}=useStore();const [query,setQuery]=useState('');const [treeId,setTreeId]=useState(initialTreeId);const [sort,setSort]=useState('name');const [view,setView]=useState<'grid'|'list'>('grid');const [edit,setEdit]=useState(false);
  const trees=data.trees.filter(t=>t.worldId===data.activeWorldId);const treeIds=new Set(trees.map(t=>t.id));
  useEffect(()=>setTreeId(trees.some(tree=>tree.id===initialTreeId)?initialTreeId:'all'),[data.activeWorldId,initialTreeId]);
  const people=useMemo(()=>data.people.filter(p=>treeIds.has(p.treeId)&&(treeId==='all'||p.treeId===treeId)&&p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='born'?(a.born||'9999').localeCompare(b.born||'9999'):a.name.localeCompare(b.name,'zh-CN')),[data.people,data.trees,treeId,query,sort,data.activeWorldId]);
  return <main className="standard-page page-enter"><div className="page-heading people-heading">{label('人物索引')}<h1 className="desktop-archive-title">人物名册</h1><div className="page-heading-row"><button className="primary-action" onClick={()=>trees.length?setEdit(true):go('/trees')}>＋ 添加人物</button></div></div><div className="index-toolbar"><label className="search-field"><span className="search-icon"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索人物姓名"/></label><div className="filters"><select aria-label="按家谱筛选" value={treeId} onChange={e=>setTreeId(e.target.value)}><option value="all">全部家谱</option>{trees.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select aria-label="排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">姓名排序</option><option value="born">出生年代</option></select><div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="网格视图">▦</button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="列表视图">☷</button></div></div></div><div className="index-count">{String(people.length).padStart(2,'0')} 位人物 <span>／ {treeId==='all'?'全部家族':data.trees.find(t=>t.id===treeId)?.name}</span></div>{people.length?<div className={view==='grid'?'people-grid':'people-list'}>{people.map((p,i)=><button className="person-index-card" key={p.id} onClick={()=>go(`/people/${p.id}`)}><span className="index-photo"><PortraitImage src={p.portrait} alt={p.name}/></span><span className="index-text"><small>编号 {String(i+1).padStart(3,'0')}</small><strong>{p.name}</strong><em>{yearsOf(p)}</em><span>{data.trees.find(t=>t.id===p.treeId)?.name} <b>↗</b></span></span></button>)}</div>:<div className="empty-state">没有找到人物。可以调整筛选，或添加新的记录。</div>}{edit&&trees.length>0&&<PersonEditor treeId={treeId!=='all'?treeId:trees[0].id} onClose={()=>setEdit(false)} onDone={id=>{setEdit(false);go(`/people/${id}`);}}/>}</main>;
}

function ProfilePage({id,go}: {id:string;go:(p:string)=>void}) {
  const {data}=useStore();
  const person=data.people.find(p=>p.id===id);
  const [edit,setEdit]=useState(false);
  const [selectedItem,setSelectedItem]=useState<ArchiveItem|null>(null);
  if(!person||data.trees.find(t=>t.id===person.treeId)?.worldId!==data.activeWorldId)return <NotFound go={go}/>;
  const rel=relationshipNames(data.people,person);
  const items=data.items.filter(item=>item.personIds.includes(id));
  const tree=data.trees.find(t=>t.id===person.treeId);
  const relations=([...rel.parents,...rel.spouses,...rel.lovers,...rel.children]).filter((p,i,all)=>all.findIndex(other=>other.id===p.id)===i);
  return <main className="record-page page-enter">
    <div className="record-frame">
      <aside className="record-sidebar"><button onClick={()=>go('/people')}>← 人物名册</button><div className="record-sidebar-rule"/><span>人物</span><span className="record-sidebar-name">{person.name}</span><span>关系</span><span>相关资料</span><div className="record-sidebar-bottom"><button onClick={()=>go(`/trees/${person.treeId}`)}>查看家谱 ↗</button></div></aside>
      <div className="record-related"><div className="record-column-head">相关人物 <span>{String(relations.length).padStart(2,'0')}</span></div><div className="record-related-list">{relations.map(p=><button key={p.id} onClick={()=>go(`/people/${p.id}`)}><PortraitImage src={p.portrait} alt={p.name}/><span>{p.name}</span></button>)}</div></div>
      <article className="record-main"><div className="record-main-top"><span>人物档案 / {tree?.name||'未归属'}</span><button onClick={()=>setEdit(true)}>编辑 ↗</button></div><div className="record-portrait"><PortraitImage src={person.portrait} alt={person.name}/></div><div className="record-main-caption"><div><span>姓名</span><h1>{person.name}</h1><p>{yearsOf(person)}</p></div><div><span>记录</span><p>{person.summary||'暂无简介'}</p></div></div><div className="record-facts"><span>出生 · {person.born||'未记录'}</span><span>逝世 · {person.died||'未记录'}</span><span>性别 · {person.gender}</span></div><section className="record-biography"><h2>人物生平</h2>{(person.biography||'暂无生平记录。').split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}{person.notes&&<p className="record-notes">备注：{person.notes}</p>}</section><section className="record-kinship"><h2>亲属关系</h2>{(['parents','spouses','lovers','children'] as const).map((key,i)=><div className="record-relation-row" key={key}><span>{['父母','配偶','情人','子女'][i]}</span><div>{rel[key].length?rel[key].map(p=><button key={p.id} onClick={()=>go(`/people/${p.id}`)}>{p.name} ↗</button>):<em>未记录</em>}</div></div>)}</section>{items.length>0&&<section className="record-material"><h2>相关资料</h2><div>{items.map(item=><button key={item.id} onClick={()=>setSelectedItem(item)}><img src={item.image} alt={item.title}/><span>{item.title}</span></button>)}</div></section>}</article>
    </div>
    {selectedItem&&<Modal title={selectedItem.title} onClose={()=>setSelectedItem(null)}><div className="record-item-view"><img src={selectedItem.image} alt={selectedItem.title}/><p>{selectedItem.description}</p><small>{selectedItem.date}</small></div></Modal>}
    {edit&&<PersonEditor person={person} treeId={person.treeId} onClose={()=>setEdit(false)} onDone={()=>setEdit(false)} onDeleted={()=>go('/people')}/>}
  </main>;
}

function WorldEditor({world,onClose}:{world?:World;onClose:()=>void}) {
  const {saveWorld,deleteWorld,data,canEdit}=useStore();const [name,setName]=useState(world?.name||'');const [description,setDescription]=useState(world?.description||'');const [confirmDelete,setConfirmDelete]=useState(false);
  if(!canEdit)return <LoginRequired onClose={onClose}/>;
  return <Modal title={world?'编辑世界线':'创建世界线'} onClose={onClose}><form className="editor-form" onSubmit={e=>{e.preventDefault();if(!name.trim())return;saveWorld({id:world?.id,name:name.trim(),description:description.trim(),isDemo:world?.isDemo||false});onClose();}}><label>名称<input required value={name} onChange={e=>setName(e.target.value)} placeholder="例如：第二次旅程"/></label><label>备注<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="游戏、存档或设定名称"/></label>{confirmDelete&&<div className="delete-confirm"><strong>删除整条世界线？</strong><span>其中的家族、人物与关系将一并移除。</span><div><button type="button" className="danger-action" onClick={()=>{if(world){deleteWorld(world.id);onClose();}}}>确认删除</button><button type="button" className="text-action" onClick={()=>setConfirmDelete(false)}>取消</button></div></div>}<div className="form-actions"><button className="primary-action" type="submit">保存世界线 ↗</button>{world&&data.worlds.length>1&&!confirmDelete&&<button type="button" className="danger-action" onClick={()=>setConfirmDelete(true)}>删除世界线</button>}</div></form></Modal>;
}

function SettingsPage() {
  const {data,setPreference,setActiveWorld,importData,resetDemo,saveStatusText,migrateLocal,canEdit,hasPending}=useStore();const {user}=useAuth();const file=useRef<HTMLInputElement>(null);const [message,setMessage]=useState('');const [worldEdit,setWorldEdit]=useState<World|'new'|null>(null);
  const exportData=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`kingdom-come-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);setMessage('数据已导出为 JSON 文件。');};
  const onImport=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;try{const value=JSON.parse(await f.text());if(!confirm('导入将替换当前浏览器中的全部数据。请确认继续。'))return;importData(value);setMessage('导入成功，档案已经更新。');}catch(err){setMessage(err instanceof Error?err.message:'无法读取文件。');}e.target.value='';};
  return <main className="standard-page settings-page page-enter"><div className="page-heading">{label('偏好与数据')}<h1>设置</h1></div><div className="settings-layout"><section><div className="settings-heading"><span>01</span><h2>世界线</h2></div><p>每条世界线独立保存家族、人物与关系。家谱与人物页面显示当前世界线的记录，首页精选全局共用。</p><div className="world-list">{data.worlds.map(world=><div className={world.id===data.activeWorldId?'world-row world-active':'world-row'} key={world.id}><button onClick={()=>setActiveWorld(world.id)}><strong>{world.name}</strong><small>{data.trees.filter(t=>t.worldId===world.id).length} 个家族 · {data.people.filter(p=>data.trees.some(t=>t.id===p.treeId&&t.worldId===world.id)).length} 位人物</small></button><button className="world-edit" onClick={()=>setWorldEdit(world)}>编辑</button></div>)}</div><button className="text-action world-add" onClick={()=>setWorldEdit('new')}>＋ 创建世界线</button><div className="settings-heading settings-subheading"><span>02</span><h2>画面与动效</h2></div><div className="setting-color"><strong>强调色</strong><div className="accent-options">{([['moss','苔石绿'],['silver','冷银灰'],['wine','暗酒红'],['copper','旧铜金']] as const).map(([key,name])=><button key={key} className={`accent-option accent-${key} ${data.preferences.accent===key?'accent-selected':''}`} onClick={()=>setPreference('accent',key)} aria-pressed={data.preferences.accent===key}><i/>{name}</button>)}</div></div><div className="setting-color"><strong>肖像边框</strong><div className="frame-options">{([['crest','复线'],['single','细线']] as const).map(([key,name])=><button key={key} className={data.preferences.portraitFrame===key?'frame-option selected':'frame-option'} aria-pressed={data.preferences.portraitFrame===key} onClick={()=>setPreference('portraitFrame',key)}><span className={'frame-mini frame-'+key}><img src='/assets/portrait-art-1.jpg' alt='' /></span>{name}</button>)}</div></div><label className="setting-row"><span><strong>档案纹理</strong><small>显示细微背景颗粒</small></span><input type="checkbox" checked={data.preferences.texture} onChange={e=>setPreference('texture',e.target.checked)}/></label><label className="setting-row"><span><strong>页面动效</strong><small>页面进入与悬停过渡</small></span><input type="checkbox" checked={data.preferences.motion} onChange={e=>setPreference('motion',e.target.checked)}/></label><label className="setting-row"><span><strong>显示生卒年</strong><small>家谱肖像下方的年代</small></span><input type="checkbox" checked={data.preferences.years} onChange={e=>setPreference('years',e.target.checked)}/></label><div className="setting-choice"><span><strong>家谱间距</strong><small>调整人物节点的呼吸感</small></span><select value={data.preferences.density} onChange={e=>setPreference('density',e.target.value as 'comfortable'|'compact')}><option value="comfortable">舒展</option><option value="compact">紧凑</option></select></div></section><section><div className="settings-heading"><span>03</span><h2>保存与同步</h2></div><AccountSettings pending={hasPending}/><div className="account-settings-row"><span>保存状态</span><span className="save-status" role="status">{saveStatusText}</span></div>{user&&<button className="text-action account-migrate" onClick={migrateLocal}>迁移本机资料 ↗</button>}<details className="account-backup"><summary>备份与恢复</summary><div className="settings-actions"><button className="primary-action" onClick={exportData}>导出数据 ↗</button><button className="site-button site-button-subtle" disabled={!canEdit} onClick={()=>file.current?.click()}>导入数据 ↗</button><input type="file" accept="application/json,.json" hidden ref={file} onChange={onImport}/></div></details><div className="settings-demo"><strong>示例世界线</strong><p>瓦伦与瑞文家族是虚构示例。</p><button className="text-action" onClick={()=>{if(confirm('恢复示例世界线？示例人物和家族的修改将被替换。')){resetDemo();setMessage('示例世界线已恢复。');}}}>恢复示例 ↗</button></div>{message&&<p className="settings-message" role="status">{message}</p>}</section></div>{worldEdit&&<WorldEditor world={worldEdit==='new'?undefined:worldEdit} onClose={()=>setWorldEdit(null)}/>}</main>;
}

function NotFound({go}: {go:(p:string)=>void}) {return <main className="not-found"><span className="eyebrow">未找到页面 / 404</span><h1>此页未被收录。</h1><button className="primary-action" onClick={()=>go('/')}>返回首页 ↗</button></main>;}

export default function App() {
  const {data,ready,saveFailure,saveStatus,retrySync,reloadCloud}=useStore();const {path,search:routeSearch,go}=useRoute();const [search,setSearch]=useState(false);
  useEffect(()=>{const login=()=>go('/login');addEventListener('kingdom-login-required',login);return()=>removeEventListener('kingdom-login-required',login);},[go]);
  useEffect(()=>{document.body.classList.toggle('no-texture',!data.preferences.texture);document.body.classList.toggle('no-motion',!data.preferences.motion);document.body.dataset.accent=data.preferences.accent;document.body.dataset.portraitFrame=data.preferences.portraitFrame;return()=>{document.body.classList.remove('no-texture','no-motion');delete document.body.dataset.accent;delete document.body.dataset.portraitFrame;};},[data.preferences.texture,data.preferences.motion,data.preferences.accent,data.preferences.portraitFrame]);
  let page:ReactNode;
  if(!ready&&path!=='/settings'&&path!=='/login'&&path!=='/register')page=<main className="account-loading" role="status">{saveFailure?'档案暂时无法读取':'正在读取档案...'}</main>;
  else if(path==='/login'||path==='/register')page=<LoginPage go={go} register={path==='/register'}/>;
  else if(path==='/')page=<Home go={go}/>;
  else if(path==='/trees')page=<TreesPage go={go}/>;
  else if(path.startsWith('/trees/'))page=<TreePage id={decodeURIComponent(path.split('/')[2])} go={go}/>;
  else if(path==='/people')page=<PeoplePage go={go} initialTreeId={new URLSearchParams(routeSearch).get('tree')||'all'}/>;
  else if(path.startsWith('/people/'))page=<ProfilePage id={decodeURIComponent(path.split('/')[2])} go={go}/>;
  else if(path==='/settings')page=<SettingsPage/>;
  else page=<NotFound go={go}/>;
  return <><Header path={path} go={go} onSearch={()=>setSearch(true)}/>{saveFailure&&<div className="save-notice" role="status"><span>{saveFailure}</span><button onClick={()=>go('/settings')}>备份资料</button>{saveStatus==='conflict'?<button onClick={reloadCloud}>读取云端版本</button>:<button onClick={()=>void retrySync()}>重试</button>}</div>}{page}{path!=='/login'&&path!=='/register'&&!path.startsWith('/trees/')&&<footer className="site-footer"><div className="footer-brand">Kingdom Come <span>✦</span></div><div><button onClick={()=>go('/settings')}>设置 ↗</button></div></footer>}{search&&<GlobalSearch onClose={()=>setSearch(false)} go={go}/>}</>;
}
