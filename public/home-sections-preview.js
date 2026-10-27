const $ = selector => document.querySelector(selector);
const frame = $('#sections-frame');
const stage = $('#canvas-stage');
const scroller = $('#canvas-scroll');
const storageKey = 'kingdom-come-home-sections-choice-v1';
const names = {folio:'馆藏对页', scroll:'谱系长卷', index:'档案索引', gallery:'肖像画廊'};
const numbers = {folio:'01', scroll:'02', index:'03', gallery:'04'};
let layout = 'folio';
let choice = {tree:null, people:null};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  for (const key of ['tree','people']) if (names[saved[key]]) choice[key] = saved[key];
} catch { choice = {tree:null, people:null}; }
let doc;
let scale = 1;
let width = innerWidth <= 760 ? 390 : 1280;
$('#preview-width').value = String(width);
let observer;
let waiting = 0;
let resizeFrame = 0;

const previewStyles = `
  html{scroll-behavior:auto!important;overflow:hidden!important}
  .section-preview{margin:0!important;background:var(--bg);overflow:visible!important}
  .section-preview .site-header,.section-preview .site-footer,.section-preview .archive-opening{display:none!important}
  .section-preview .home-archive-sections{display:contents!important}
  .section-preview .archive-home{max-width:1480px;margin:0 auto;padding:38px 48px 44px;overflow:clip;animation:none!important}
  .section-preview .archive-home .home-tree-section,.section-preview .archive-home .home-index{min-width:0;max-width:none;margin:0;padding:0;border:0;scroll-margin:0}
  .section-preview .archive-home .home-section-heading{grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:12px;margin:0 0 25px;padding:0 0 18px;border-bottom:1px solid var(--line)}
  .section-preview .archive-home .home-section-number{font-size:22px;line-height:1;align-self:center;padding:0;color:#939f96}
  .section-preview .archive-home .home-section-label{font-size:9px;letter-spacing:.12em;line-height:1.7;color:#a9b8ad}
  .section-preview .archive-home .home-section-heading h2{font-size:28px;line-height:1.35;letter-spacing:.025em;margin:5px 0 0}
  .section-preview .archive-home .home-section-heading>.text-action{font-size:9px;line-height:1.7;gap:12px;margin:0;align-self:end;padding-bottom:3px}
  .section-preview .archive-home .home-section-heading>.text-action span{font-size:15px}
  .section-preview .archive-home .home-featured-layout{display:block;min-width:0;height:auto;gap:25px}
  .section-preview .archive-home .home-tree-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 18px;padding:0 0 22px}
  .section-preview .archive-home .home-tree-copy>.home-section-label{grid-column:1}
  .section-preview .archive-home .home-tree-copy h3{grid-column:1;font-size:25px;line-height:1.5;margin:0}
  .section-preview .archive-home .home-tree-copy p{grid-column:1;max-width:none;margin:0;font-size:11px;line-height:1.85}
  .section-preview .archive-home .home-tree-count{grid-column:2;grid-row:1/3;border:0;margin:0;padding:0;font-size:10px;color:var(--muted)}
  .section-preview .archive-home .home-tree-copy>.text-action{grid-column:2;grid-row:3;justify-self:end;margin:0;font-size:10px}
  .section-preview .archive-home .home-tree-preview{height:410px;min-width:0;border:1px solid #414846;overflow:hidden}
  .section-preview .archive-home .home-tree-preview .tree-viewport{height:100%}
  .section-preview .archive-home .home-index-portraits{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
  .section-preview .archive-home .home-index-portraits>button{min-width:0;margin:0;border:0;padding:0;background:none;color:var(--ink);text-align:left}
  .section-preview .archive-home .home-index-photo{height:auto;aspect-ratio:.84;overflow:hidden;background:#242727}
  .section-preview .archive-home .home-index-photo img{width:100%;height:100%;object-fit:cover;object-position:center 23%}
  .section-preview .archive-home .home-index-caption{display:grid;grid-template-columns:18px minmax(0,1fr);gap:5px 8px;padding-top:11px;margin-top:12px;border-top:1px solid var(--line)}
  .section-preview .archive-home .home-index-caption small{font:10px var(--serif);color:#9baa9f}
  .section-preview .archive-home .home-index-caption strong{font:400 13px/1.7 'Noto Serif SC',serif}
  .section-preview .archive-home .home-index-caption em{grid-column:2;font:11px/1.6 var(--serif);color:var(--muted)}
  .section-preview .archive-home button:focus-visible{outline:1px solid var(--accent-strong);outline-offset:4px}
  .section-preview[data-layout=folio] .archive-home{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:38px}
  .section-preview[data-layout=folio] .home-tree-preview{height:442px}
  .section-preview[data-layout=folio] .home-index-portraits{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 17px}
  .section-preview[data-layout=folio] .home-index-photo{aspect-ratio:.8}
  .section-preview[data-layout=folio] .home-index-caption strong{font-size:12px}
  .section-preview[data-layout=folio] .home-index-caption em{font-size:10px}
  .section-preview[data-layout=scroll] .archive-home{display:flex;flex-direction:column;gap:30px}
  .section-preview[data-layout=scroll] .home-featured-layout{display:grid;grid-template-columns:185px minmax(0,1fr);gap:32px}
  .section-preview[data-layout=scroll] .home-tree-copy{display:flex;flex-direction:column;align-items:start;align-self:center;padding:0}
  .section-preview[data-layout=scroll] .home-tree-copy h3{margin:8px 0 5px;font-size:27px}
  .section-preview[data-layout=scroll] .home-tree-copy p{max-width:19ch}
  .section-preview[data-layout=scroll] .home-tree-count{width:100%;border-top:1px solid var(--line);margin-top:19px;padding-top:14px}
  .section-preview[data-layout=scroll] .home-tree-copy>.text-action{margin-top:13px}
  .section-preview[data-layout=scroll] .home-tree-preview{height:382px}
  .section-preview[data-layout=scroll] .home-index{display:grid;grid-template-columns:185px minmax(0,1fr);gap:32px;border-top:1px solid var(--line);padding-top:24px}
  .section-preview[data-layout=scroll] .home-index .home-section-heading{display:flex;flex-direction:column;align-items:start;gap:8px;padding:0;margin:0;border:0}
  .section-preview[data-layout=scroll] .home-index .home-section-heading>.text-action{align-self:start;margin-top:7px}
  .section-preview[data-layout=scroll] .home-index .home-section-number{display:none}
  .section-preview[data-layout=scroll] .home-index-portraits{gap:13px;align-items:center}
  .section-preview[data-layout=scroll] .home-index-portraits>button{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:11px;padding-right:12px;border-right:1px solid var(--line)}
  .section-preview[data-layout=scroll] .home-index-portraits>button:last-child{border:0;padding:0}
  .section-preview[data-layout=scroll] .home-index-photo{height:85px;aspect-ratio:auto}
  .section-preview[data-layout=scroll] .home-index-caption{display:flex;flex-direction:column;gap:5px;border:0;margin:0;padding:0}
  .section-preview[data-layout=scroll] .home-index-caption strong{font-size:12px;line-height:1.75}
  .section-preview[data-layout=scroll] .home-index-caption small{font-size:9px}
  .section-preview[data-layout=scroll] .home-index-caption em{font-size:10px}
  .section-preview[data-layout=index] .archive-home{display:grid;grid-template-columns:minmax(240px,.85fr) minmax(0,2fr);gap:42px}
  .section-preview[data-layout=index] .home-index{grid-column:1;grid-row:1;border-right:1px solid var(--line);padding-right:30px}
  .section-preview[data-layout=index] .home-tree-section{grid-column:2;grid-row:1}
  .section-preview[data-layout=index] .home-index .home-section-heading{grid-template-columns:22px minmax(0,1fr);gap:8px 11px}
  .section-preview[data-layout=index] .home-index .home-section-heading>.text-action{grid-column:2;justify-self:start;margin-top:7px}
  .section-preview[data-layout=index] .home-index-portraits{display:flex;flex-direction:column;gap:0}
  .section-preview[data-layout=index] .home-index-portraits>button{display:grid;grid-template-columns:59px minmax(0,1fr);align-items:center;gap:15px;border-bottom:1px solid var(--line);padding:15px 0;width:100%}
  .section-preview[data-layout=index] .home-index-portraits>button:first-child{padding-top:0}
  .section-preview[data-layout=index] .home-index-photo{height:80px;aspect-ratio:auto}
  .section-preview[data-layout=index] .home-index-caption{display:flex;flex-direction:column;gap:4px;padding:0;margin:0;border:0}
  .section-preview[data-layout=index] .home-index-caption strong{font-size:14px}
  .section-preview[data-layout=index] .home-tree-preview{height:455px;border:0;border-block:1px solid var(--line)}
  .section-preview[data-layout=gallery] .archive-home{display:flex;flex-direction:column;gap:43px}
  .section-preview[data-layout=gallery] .home-index{order:-1;display:grid;grid-template-columns:175px minmax(0,1fr);gap:32px}
  .section-preview[data-layout=gallery] .home-section-heading{display:flex;flex-direction:column;align-items:start;gap:12px;border:0;padding:0;margin:0}
  .section-preview[data-layout=gallery] .home-section-heading .home-section-number{align-self:start;font-size:27px}
  .section-preview[data-layout=gallery] .home-section-heading>.text-action{align-self:start;margin-top:15px}
  .section-preview[data-layout=gallery] .home-index-photo{height:190px;aspect-ratio:auto}
  .section-preview[data-layout=gallery] .home-index-caption{grid-template-columns:minmax(0,1fr)}
  .section-preview[data-layout=gallery] .home-index-caption small{display:none}
  .section-preview[data-layout=gallery] .home-index-caption em{grid-column:1}
  .section-preview[data-layout=gallery] .home-tree-section{display:grid;grid-template-columns:175px minmax(0,1fr);grid-template-rows:auto 1fr;gap:24px 32px;border-top:1px solid var(--line);padding-top:30px}
  .section-preview[data-layout=gallery] .home-tree-section .home-section-heading{grid-column:1;grid-row:1}
  .section-preview[data-layout=gallery] .home-featured-layout{display:contents}
  .section-preview[data-layout=gallery] .home-tree-copy{grid-column:1;grid-row:2;display:block;align-self:start;padding:0}
  .section-preview[data-layout=gallery] .home-tree-copy h3{font-size:22px;margin:6px 0 8px}
  .section-preview[data-layout=gallery] .home-tree-copy>.home-section-label{display:none}
  .section-preview[data-layout=gallery] .home-tree-count{margin-top:18px;padding-top:12px;border-top:1px solid var(--line)}
  .section-preview[data-layout=gallery] .home-tree-copy>.text-action{margin-top:13px;display:inline-block}
  .section-preview[data-layout=gallery] .home-tree-preview{grid-column:2;grid-row:1/3;height:357px}
  @media(max-width:1050px) and (min-width:801px){
    .section-preview .archive-home{padding:32px 34px}
    .section-preview[data-layout=folio] .archive-home{gap:26px;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
    .section-preview .archive-home .home-section-heading{grid-template-columns:20px minmax(0,1fr);gap:7px 10px}
    .section-preview .archive-home .home-section-heading>.text-action{grid-column:2;justify-self:start}
    .section-preview .archive-home .home-section-heading h2{font-size:26px}
    .section-preview[data-layout=scroll] .home-index-portraits{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    .section-preview[data-layout=index] .archive-home{grid-template-columns:245px minmax(0,1fr);gap:28px}
    .section-preview[data-layout=index] .home-index{padding-right:23px}
  }
  @media(max-width:800px){
    .section-preview[data-layout] .archive-home{display:flex;flex-direction:column;padding:25px 20px 32px;gap:35px}
    .section-preview[data-layout] .archive-home .home-tree-section,.section-preview[data-layout] .archive-home .home-index{display:block;padding:0;border:0}
    .section-preview[data-layout] .archive-home .home-section-heading{display:grid;grid-template-columns:22px minmax(0,1fr);gap:6px 10px;margin:0 0 22px;padding:0 0 17px;border-bottom:1px solid var(--line)}
    .section-preview[data-layout] .archive-home .home-section-heading>.text-action{grid-column:2;justify-self:start;align-self:start;margin:4px 0 0}
    .section-preview[data-layout] .archive-home .home-section-heading h2{font-size:25px}
    .section-preview[data-layout] .archive-home .home-section-number{display:block;font-size:20px;align-self:center}
    .section-preview[data-layout] .archive-home .home-featured-layout{display:block}
    .section-preview[data-layout] .archive-home .home-tree-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;padding:0 0 20px}
    .section-preview[data-layout] .archive-home .home-tree-copy h3{font-size:23px;margin:0}
    .section-preview[data-layout] .archive-home .home-tree-copy p{max-width:none}
    .section-preview[data-layout] .archive-home .home-tree-count{width:auto;border:0;padding:0;margin:0}
    .section-preview[data-layout] .archive-home .home-tree-copy>.text-action{margin:0}
    .section-preview[data-layout] .archive-home .home-tree-preview{height:340px}
    .section-preview[data-layout] .archive-home .home-index-portraits{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:23px 16px}
    .section-preview[data-layout] .archive-home .home-index-portraits>button{display:block;width:auto;border:0;padding:0}
    .section-preview[data-layout] .archive-home .home-index-photo{height:auto;aspect-ratio:.84}
    .section-preview[data-layout] .archive-home .home-index-caption{display:grid;grid-template-columns:16px minmax(0,1fr);padding-top:11px;margin-top:12px;border-top:1px solid var(--line)}
    .section-preview[data-layout] .archive-home .home-index-caption strong{font-size:12px}
    .section-preview[data-layout] .archive-home .home-index-caption small{display:block}
    .section-preview[data-layout] .archive-home .home-index-caption em{grid-column:2}
    .section-preview[data-layout=index] .archive-home .home-index-portraits{display:flex;flex-direction:column;gap:0}
    .section-preview[data-layout=index] .archive-home .home-index-portraits>button{display:grid;grid-template-columns:64px minmax(0,1fr);gap:17px;align-items:center;width:100%;padding:12px 0;border-bottom:1px solid var(--line)}
    .section-preview[data-layout=index] .archive-home .home-index-photo{height:83px;aspect-ratio:auto}
    .section-preview[data-layout=index] .archive-home .home-index-caption{display:flex;flex-direction:column;gap:4px;border:0;margin:0;padding:0}
    .section-preview[data-layout=gallery] .archive-home .home-index{order:-1}
    .section-preview[data-layout=gallery] .archive-home .home-tree-section{border-top:1px solid var(--line);padding-top:25px}
  }
  .section-preview .archive-home .home-section-label{font-size:11px}
  .section-preview .archive-home .home-section-heading>.text-action{font-size:11px}
  .section-preview .archive-home .home-tree-copy p{font-size:13px}
  .section-preview .archive-home .home-tree-count,.section-preview .archive-home .home-tree-copy>.text-action{font-size:12px}
  .section-preview .archive-home .home-index-caption strong{font-size:14px}
  .section-preview .archive-home .home-index-caption em{font-size:12px}
  @media(prefers-reduced-motion:reduce){.section-preview *{transition:none!important;animation:none!important}}
`;

function updateChoice() {
  $('#tree-choice').textContent = `家谱区：${names[choice.tree] || '尚未选择'}`;
  $('#people-choice').textContent = `人物区：${names[choice.people] || '尚未选择'}`;
  $('#choose-tree').setAttribute('aria-pressed', String(choice.tree === layout));
  $('#choose-people').setAttribute('aria-pressed', String(choice.people === layout));
  $('#copy-choice').disabled = !choice.tree && !choice.people;
  $('#download-choice').disabled = !choice.tree && !choice.people;
  try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch { $('#preview-state').textContent = '选择可复制或下载保存'; }
}

function choiceText() {
  return `Kingdom Come 首页下方排版选择：\n家族谱系：${choice.tree ? `${numbers[choice.tree]} · ${names[choice.tree]}` : '暂未选择'}\n人物名册：${choice.people ? `${numbers[choice.people]} · ${names[choice.people]}` : '暂未选择'}\n仅调整首页下方两个区域。`;
}

function resize() {
  if (!doc?.querySelector('.archive-home')) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const horizontalPadding = innerWidth <= 760 ? 28 : 48;
    scale = $('#preview-zoom').value === '1' ? 1 : Math.min(1, Math.max(.15, (scroller.clientWidth - horizontalPadding) / width));
    frame.style.width = `${width}px`;
    frame.style.transform = `scale(${scale})`;
    const height = Math.ceil(doc.querySelector('.archive-home').getBoundingClientRect().bottom + 8);
    frame.style.height = `${height}px`;
    stage.style.width = `${width * scale}px`;
    stage.style.height = `${height * scale}px`;
    $('#preview-state').textContent = `${names[layout]} · ${width} px · ${Math.round(scale * 100)}%`;
  });
}

function setLayout(next) {
  layout = next;
  for (const button of document.querySelectorAll('.scheme')) {
    button.classList.toggle('active', button.dataset.layout === layout);
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  }
  $('#scheme-code').textContent = numbers[layout];
  $('#scheme-name').textContent = names[layout];
  if (doc) {
    doc.body.dataset.layout = layout;
    const treeNumber = doc.querySelector('.home-tree-section .home-section-number');
    const peopleNumber = doc.querySelector('.home-index .home-section-number');
    if (treeNumber) treeNumber.textContent = layout === 'gallery' ? '02' : '01';
    if (peopleNumber) peopleNumber.textContent = layout === 'gallery' ? '01' : '02';
  }
  scroller.scrollTo(0, 0);
  updateChoice(); resize();
}

function openArchive(event) {
  const button = event.target.closest?.('button');
  if (!button) return;
  event.preventDefault(); event.stopPropagation();
  let archive;
  try { archive = JSON.parse(localStorage.getItem('kingdom-come-v3')); } catch { archive = null; }
  const trees = archive?.trees?.filter(tree => tree.worldId === archive.activeWorldId) || [];
  const featured = trees.find(tree => tree.id === 'tree-valen') || trees[0];
  let target;
  if (button.closest('.home-index')) {
    const personName = button.querySelector('.home-index-caption strong')?.textContent;
    const person = archive?.people?.find(person => person.name === personName && trees.some(tree => tree.id === person.treeId));
    target = person ? `/people/${encodeURIComponent(person.id)}` : '/people';
  } else if (button.closest('.home-tree-copy,.home-tree-preview')) target = featured ? `/trees/${encodeURIComponent(featured.id)}` : '/trees';
  else target = '/trees';
  window.open(target, '_blank', 'noopener');
}

async function loadPreview() {
  doc = frame.contentDocument;
  if (!doc?.querySelector('.archive-home')) {
    if (waiting++ < 600) requestAnimationFrame(loadPreview);
    else $('#loading').textContent = '首页未能载入，请刷新预览页。';
    return;
  }
  waiting = 0;
  if (doc.body.classList.contains('section-preview')) return;
  doc.body.classList.add('section-preview');
  const style = doc.createElement('style'); style.textContent = previewStyles; doc.head.append(style);
  doc.addEventListener('click', openArchive, true);
  doc.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault(); scroller.scrollBy({top:event.deltaY, left:event.deltaX});
  }, {passive:false});
  let touchY = null;
  doc.addEventListener('touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, {passive:true});
  doc.addEventListener('touchmove', event => {
    if (touchY === null || event.touches.length !== 1) return;
    const nextY = event.touches[0].clientY;
    event.preventDefault(); scroller.scrollBy({top:touchY - nextY}); touchY = nextY;
  }, {passive:false});
  doc.addEventListener('touchend', () => { touchY = null; }, {passive:true});
  doc.addEventListener('keydown', event => {
    if (event.target.closest('input,textarea,select')) return;
    const keyScroll = {ArrowDown:60, ArrowUp:-60, PageDown:scroller.clientHeight*.8, PageUp:-scroller.clientHeight*.8}[event.key];
    if (keyScroll) { event.preventDefault(); scroller.scrollBy({top:keyScroll}); }
  });
  observer?.disconnect(); observer = new ResizeObserver(resize);
  observer.observe(doc.querySelector('.archive-home'));
  setLayout(layout);
  await Promise.race([doc.fonts.ready, new Promise(resolve => setTimeout(resolve, 1600))]);
  $('#loading').hidden = true;
  resize();
}

frame.addEventListener('load', loadPreview);
if (frame.contentDocument?.readyState === 'complete') loadPreview();
for (const button of document.querySelectorAll('.scheme')) button.addEventListener('click', () => setLayout(button.dataset.layout));
$('#preview-width').addEventListener('change', event => {
  width = Number(event.target.value); frame.style.width = `${width}px`; scroller.scrollTo(0,0); resize();
});
$('#preview-zoom').addEventListener('change', resize);
$('#focus-view').addEventListener('click', () => {
  const expanded = document.body.classList.toggle('focus-view');
  $('#focus-view').setAttribute('aria-pressed', String(expanded));
  $('#focus-view').textContent = expanded ? '返回方案选择 ↙' : '展开画面 ↗';
  resize();
});
$('#choose-tree').addEventListener('click', () => { choice.tree = choice.tree === layout ? null : layout; updateChoice(); });
$('#choose-people').addEventListener('click', () => { choice.people = choice.people === layout ? null : layout; updateChoice(); });
$('#copy-choice').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(choiceText());
    $('#copy-choice').textContent = '已复制 ✓';
    setTimeout(() => { $('#copy-choice').textContent = '复制选择 ↗'; }, 1800);
  } catch {
    $('#choice-text').value = choiceText(); $('#choice-dialog').showModal();
  }
});
$('#download-choice').addEventListener('click', () => {
  const result = {application:'Kingdom Come',type:'home-sections-choice',version:1,treeLayout:choice.tree,peopleLayout:choice.people,labels:names};
  const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'kingdom-come-home-sections.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#close-dialog').addEventListener('click', () => $('#choice-dialog').close());
$('#select-choice').addEventListener('click', () => { $('#choice-text').focus(); $('#choice-text').select(); });
new ResizeObserver(resize).observe(scroller);
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-h', `${document.querySelector('.preview-header').offsetHeight}px`);
  document.documentElement.style.setProperty('--dock-h', `${document.querySelector('.selection-dock').offsetHeight}px`);
}).observe(document.querySelector('.selection-dock'));
updateChoice();
