export type Person = {
  id: string; treeId: string; name: string; born: string; died: string; gender: string;
  portrait: string; portraitOriginal?: string; summary: string; biography: string; notes: string;
  parentIds: string[]; spouseIds: string[]; loverIds: string[];
};
export type World = { id: string; name: string; description: string; isDemo: boolean };
export type FamilyTree = { id: string; worldId: string; name: string; subtitle: string; description: string; cover: string; isDemo: boolean };
export type ArchiveItem = { id: string; title: string; description: string; kind: 'photograph' | 'document' | 'image'; image: string; date: string; personIds: string[]; isDemo: boolean };
export type Accent = 'moss' | 'silver' | 'wine' | 'copper';
export type ArchiveData = { version: 3; worlds: World[]; activeWorldId: string; featuredTreeId: string | null; trees: FamilyTree[]; people: Person[]; items: ArchiveItem[]; preferences: { texture: boolean; years: boolean; motion: boolean; accent: Accent; density: 'comfortable' | 'compact'; portraitFrame: 'crest' | 'single' } };
export const portrait = (n: number) => `/assets/portrait-art-${n}.jpg`;
const record = (id:string,treeId:string,name:string,born:string,died:string,gender:string,portraitNo:number,summary:string,parentIds:string[]=[],spouseIds:string[]=[],loverIds:string[]=[]):Person => ({
  id,treeId,name,born,died,gender,portrait:portrait(portraitNo),summary,
  biography:summary,
  notes:'',parentIds,spouseIds,loverIds
});
export const initialData: ArchiveData = {
  version: 3,
  worlds: [{id:'world-demo',name:'示例世界线',description:'瓦伦与瑞文家族',isDemo:true}],
  activeWorldId:'world-demo',
  featuredTreeId:'tree-valen',
  trees: [
    {id:'tree-valen',worldId:'world-demo',name:'瓦伦家族',subtitle:'',description:'灰岩堡家族谱系',cover:'/assets/archive-court.jpg',isDemo:true},
    {id:'tree-ravenne',worldId:'world-demo',name:'瑞文家族',subtitle:'',description:'北境家族谱系',cover:'/assets/archive-marriage.jpg',isDemo:true}
  ],
  people: [
    record('p1','tree-valen','埃德蒙·瓦伦','1321','1388','男',1,'灰岩堡领主，留下了详尽的封地与继承记录。',[],['p2']),
    record('p2','tree-valen','伊莎贝拉·瓦伦','1327','1396','女',2,'领主夫人，主持城堡的书房与信件收藏。',[],['p1']),
    record('p3','tree-valen','阿德里安·瓦伦','1352','1413','男',3,'瓦伦继承人，与瑞文家族结成婚盟。',['p1','p2'],['p6']),
    record('p4','tree-valen','玛蒂尔达·瓦伦','1356','1420','女',4,'善于绘制纹章和抄写谱系，与罗兰保持私人通信。',['p1','p2'],[],['p7']),
    record('p5','tree-ravenne','雷纳德·瑞文','1324','1390','男',5,'北境守卫者，瑞文家族的长者。',[],['p8']),
    record('p6','tree-ravenne','艾莉诺·瑞文','1354','1418','女',6,'来自瑞文家族，与阿德里安成婚。',['p5','p8'],['p3']),
    record('p7','tree-ravenne','罗兰·瑞文','1358','1407','男',7,'北境使者，与玛蒂尔达保持一段未写入婚册的情感。',['p5','p8'],[],['p4']),
    record('p8','tree-ravenne','海伦娜·瑞文','1329','1402','女',8,'瑞文家族的家主夫人，保存了北境婚册。',[],['p5']),
    record('p9','tree-valen','朱利安·瓦伦','1381','1447','男',9,'阿德里安与艾莉诺之子，继承两家的纹章。',['p3','p6'])
  ],
  items: [
    {id:'a1',title:'婚约手稿',description:'示例资料；图像为真实中世纪手稿。',kind:'document',image:'/assets/archive-marriage.jpg',date:'约 1380',personIds:['p1','p2','p3','p6'],isDemo:true},
    {id:'a2',title:'宫廷场景',description:'示例资料；图像为真实馆藏织物。',kind:'image',image:'/assets/archive-court.jpg',date:'十四世纪末',personIds:['p1','p2'],isDemo:true},
    {id:'a3',title:'祈祷书页',description:'示例资料；图像为真实中世纪手稿。',kind:'document',image:'/assets/archive-manuscript.jpg',date:'约 1376',personIds:['p3','p4','p6','p7'],isDemo:true}
  ],
  preferences:{texture:true,years:true,motion:true,accent:'moss',density:'comfortable',portraitFrame:'crest'}
};
export const yearsOf = (p:Person) => `${p.born || '生年不详'} — ${p.died || '未记录'}`;
export const resolveFeaturedTree = (trees:FamilyTree[],id?:string|null) => trees.find(t=>t.id===id)||trees.find(t=>t.id===initialData.featuredTreeId)||trees[0];
export const childrenOf = (people:Person[],id:string) => people.filter(p=>p.parentIds.includes(id));
export const relativesOf = (people:Person[],p:Person) => new Set([...p.parentIds,...p.spouseIds,...p.loverIds,...childrenOf(people,p.id).map(c=>c.id)]);
export const visiblePeopleForTree = (people:Person[],treeId:string) => {
  const own=people.filter(p=>p.treeId===treeId);
  const ids=new Set(own.map(p=>p.id));
  own.forEach(p=>[...p.parentIds,...p.spouseIds,...p.loverIds,...childrenOf(people,p.id).map(c=>c.id)].forEach(id=>ids.add(id)));
  return people.filter(p=>ids.has(p.id));
};
export function wouldCreateCycle(people:Person[],id:string,parents:string[],children:string[]) {
  const childSet=new Set(children);
  const links=new Map(people.map(p=>[p.id,p.id===id?parents:[...p.parentIds.filter(x=>x!==id),...(childSet.has(p.id)?[id]:[])]]));
  if(!links.has(id))links.set(id,parents);
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(key:string):boolean=>{
    if(visiting.has(key))return true;
    if(visited.has(key))return false;
    visiting.add(key);
    if((links.get(key)||[]).some(visit))return true;
    visiting.delete(key);visited.add(key);return false;
  };
  return [...links.keys()].some(visit);
}
