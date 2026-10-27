const $ = selector => document.querySelector(selector);
const frame = $('#homepage');
const stage = $('#stage');
const scroller = $('#canvas-scroll');
const form = $('#properties');
const storageKey = 'kingdom-come-home-layout-editor-v1';
const fields = ['x', 'y', 'w', 'h', 'fontSize', 'lineHeight', 'font', 'text', 'fit', 'imageY', 'z', 'opacity', 'locked', 'hidden'];
let layouts = {};
try { layouts = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { layouts = {}; }
let width = 1440;
let selected = '';
let items = [];
let doc;
let overlay;
let editing = true;
let scale = 1;
let gesture = null;
let history = ['{}'];
let historyIndex = 0;
let updateFrame = 0;
let loadingFrames = 0;
const round = n => Math.round(n * 10) / 10;
const edits = () => layouts[width] || (layouts[width] = {});
const current = () => items.find(item => item.id === selected);
const state = () => JSON.stringify(edits());
const snap = n => $('#snap').checked ? Math.round(n / 8) * 8 : round(n);

const definitions = [
  ['首屏 · 文字与入口', [
    ['opening', '.archive-opening', '首屏整体', 'group'],
    ['meta', '.opening-meta', '顶部索引与世界线', 'module', 1],
    ['wordmark', '.opening-wordmark', '英文小标题', 'text', 1],
    ['title', '.opening-heading h1', '家族档案', 'text', 1],
    ['aside', '.opening-aside', '右侧谱系统计', 'module', 1],
    ['links', '.opening-links', '浏览与查找入口', 'module', 1],
  ]],
  ['首屏 · 图片与强调色', [
    ['collage', '.archive-collage', '图片拼贴整体', 'group'],
    ['back-image', '.collage-sheet-back', '后层手稿', 'image', 1],
    ['front-image', '.collage-sheet-front', '中层手稿', 'image', 1],
    ['primary-image', '.collage-primary', '前景宫廷织物', 'image', 1],
    ['caption', '.collage-caption', '强调色家谱卡片', 'module', 1],
    ['caption-label', '.collage-caption small', '精选家谱标签', 'text', 1],
    ['caption-title', '.collage-caption strong', '卡片家族名称', 'text', 1],
  ]],
  ['下方 · 家族谱系', [
    ['tree-section', '.home-tree-section', '家族谱系整体', 'group'],
    ['tree-heading', '.home-tree-section .home-section-heading', '章节标题整体', 'module', 1],
    ['tree-number', '.home-tree-section .home-section-number', '章节编号', 'text', 1],
    ['tree-label', '.home-tree-section .home-section-heading .home-section-label', '谱系索引标签', 'text', 1],
    ['tree-title', '.home-tree-section h2', '家族谱系标题', 'text', 1],
    ['tree-more', '.home-tree-section .home-section-heading .text-action', '浏览全部家谱入口', 'module', 1],
    ['tree-copy', '.home-tree-copy', '精选家族介绍', 'module', 1],
    ['tree-name', '.home-tree-copy h3', '家族名称', 'text', 1],
    ['tree-description', '.home-tree-copy p', '家族简介', 'text', 1],
    ['tree-preview', '.home-tree-preview', '六边形家谱预览', 'module', 1],
  ]],
  ['下方 · 人物名册', [
    ['people-section', '.home-index', '人物名册整体', 'group'],
    ['people-heading', '.home-index .home-section-heading', '章节标题整体', 'module', 1],
    ['people-number', '.home-index .home-section-number', '章节编号', 'text', 1],
    ['people-label', '.home-index .home-section-label', '肖像索引标签', 'text', 1],
    ['people-title', '.home-index h2', '人物名册标题', 'text', 1],
    ['people-more', '.home-index .home-section-heading .text-action', '查看全部人物入口', 'module', 1],
    ['portraits', '.home-index-portraits', '肖像列表整体', 'group', 1],
    ...Array.from({length: 4}, (_, i) => [`person-${i}`, `.home-index-portraits>button:nth-child(${i + 1})`, `人物肖像 ${String(i + 1).padStart(2, '0')}`, 'image', 1]),
  ]],
];

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layouts));
    $('#save-state').textContent = '调整已自动保存';
  } catch { $('#save-state').textContent = '无法自动保存，请导出配置'; }
}

function commit() {
  const next = state();
  if (history[historyIndex] !== next) {
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    if (history.length > 80) history.shift();
    historyIndex = history.length - 1;
  }
  $('#undo').disabled = historyIndex === 0;
  $('#redo').disabled = historyIndex === history.length - 1;
  persist();
  updateLayers();
}

function travel(step) {
  const index = historyIndex + step;
  if (index < 0 || index >= history.length) return;
  historyIndex = index;
  layouts[width] = JSON.parse(history[index]);
  applyAll();
  commit();
}

function apply(item) {
  const change = edits()[item.id] || {};
  const el = item.el;
  if (item.originalStyle === null) el.removeAttribute('style');
  else el.setAttribute('style', item.originalStyle);
  if (item.kind === 'text') el.textContent = change.text ?? item.originalText;
  if (change.w !== undefined || change.h !== undefined) {
    if (item.base.display === 'inline') el.style.display = 'inline-block';
    el.style.boxSizing = 'border-box';
    el.style.minWidth = '0'; el.style.maxWidth = 'none';
    el.style.minHeight = '0'; el.style.maxHeight = 'none';
    el.style.flexShrink = '0';
    if (change.w !== undefined) el.style.width = `${change.w}px`;
    if (change.h !== undefined) { el.style.height = `${change.h}px`; el.style.aspectRatio = 'auto'; }
  }
  if (change.x || change.y) el.style.translate = `${change.x || 0}px ${change.y || 0}px`;
  if (change.fontSize !== undefined) el.style.fontSize = `${change.fontSize}px`;
  if (change.lineHeight !== undefined) el.style.lineHeight = String(change.lineHeight);
  if (change.font) el.style.fontFamily = change.font;
  if (change.z !== undefined) {
    if (item.base.position === 'static') el.style.position = 'relative';
    el.style.zIndex = String(change.z);
  }
  if (change.opacity !== undefined) el.style.opacity = String(change.opacity / 100);
  if (change.hidden) el.style.visibility = 'hidden';
  if (item.image) {
    if (item.originalImageStyle === null) item.image.removeAttribute('style');
    else item.image.setAttribute('style', item.originalImageStyle);
    if (change.fit) item.image.style.objectFit = change.fit;
    if (change.imageY !== undefined) item.image.style.objectPosition = `center ${change.imageY}%`;
  }
}

function applyAll() {
  items.forEach(apply);
  schedule();
  updateProperties();
  updateLayers();
}

function updateLayers() {
  for (const button of $('#layers').querySelectorAll('.layer')) {
    const change = edits()[button.dataset.id] || {};
    button.classList.toggle('is-selected', button.dataset.id === selected);
    button.classList.toggle('is-changed', Object.keys(change).length > 0);
    button.classList.toggle('is-hidden', !!change.hidden);
    button.setAttribute('aria-pressed', String(button.dataset.id === selected));
    button.querySelector('.state').textContent = change.locked ? '锁' : change.hidden ? '隐' : '';
  }
}

function dimensions(item) {
  const css = frame.contentWindow.getComputedStyle(item.el);
  return {w: parseFloat(css.width) || item.el.offsetWidth, h: parseFloat(css.height) || item.el.offsetHeight, fontSize: parseFloat(css.fontSize), lineHeight: parseFloat(css.lineHeight) / parseFloat(css.fontSize) || 1.65};
}

function updateProperties() {
  const item = current();
  form.hidden = !item;
  $('#empty-selection').hidden = !!item;
  if (!item) { $('#selection-kind').textContent = '未选择'; return; }
  const change = edits()[item.id] || {};
  const size = dimensions(item);
  $('#selection-name').textContent = item.name;
  $('#selection-kind').textContent = {group:'整体', module:'模块', text:'文字', image:'图片'}[item.kind];
  const values = {x:change.x || 0, y:change.y || 0, w:round(size.w), h:round(size.h), fontSize:round(size.fontSize), lineHeight:Math.round(size.lineHeight * 100) / 100, font:change.font || '', text:item.el.textContent, fit:change.fit || item.base.fit || 'cover', imageY:change.imageY ?? item.base.imageY, z:change.z ?? item.base.z, opacity:change.opacity ?? 100, locked:!!change.locked, hidden:!!change.hidden};
  for (const name of fields) {
    const input = form.elements.namedItem(name);
    if (input.type === 'checkbox') input.checked = values[name];
    else input.value = values[name];
    if (['x','y','w','h'].includes(name)) input.disabled = !!change.locked;
  }
  $('#text-properties').hidden = item.kind !== 'text';
  $('#image-properties').hidden = !item.image;
  const rect = item.el.getBoundingClientRect();
  $('#position-note').textContent = `画布坐标 ${Math.round(rect.left)} / ${Math.round(rect.top)} px`;
}

function select(id, reveal = false) {
  selected = id;
  updateProperties(); updateLayers(); drawOverlay();
  if (reveal && current()) {
    const rect = current().el.getBoundingClientRect();
    scroller.scrollTo({top:Math.max(0, rect.top * scale - 110), behavior:'smooth'});
  }
}

function drawOverlay() {
  if (!overlay) return;
  const item = current();
  overlay.style.display = item && editing && !edits()[item.id]?.hidden ? 'block' : 'none';
  if (!item) return;
  const rect = item.el.getBoundingClientRect();
  Object.assign(overlay.style, {left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, height:`${rect.height}px`});
  overlay.dataset.locked = String(!!edits()[item.id]?.locked);
  overlay.querySelector('.kc-label').textContent = `${item.name} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  overlay.querySelector('.kc-label').style.top = rect.top < 24 ? '3px' : '-25px';
  overlay.style.setProperty('--kc-handle', `${8 / scale}px`);
  overlay.style.setProperty('--kc-label-size', `${Math.min(18, 10 / scale)}px`);
}

function schedule() {
  cancelAnimationFrame(updateFrame);
  updateFrame = requestAnimationFrame(() => {
    const root = doc.querySelector('#root');
    const bounds = items.filter(item => !edits()[item.id]?.hidden).map(item => item.el.getBoundingClientRect().bottom);
    const height = Math.ceil(Math.max(root?.getBoundingClientRect().bottom || 0, ...bounds) + 60);
    frame.style.height = `${height}px`;
    stage.style.height = `${height * scale}px`;
    drawOverlay();
  });
}

function fitCanvas() {
  const requested = $('#zoom').value;
  scale = requested === 'fit' ? Math.max(.12, Math.min(1, (scroller.clientWidth - (innerWidth <= 760 ? 24 : 56)) / width)) : Number(requested);
  frame.style.width = `${width}px`;
  frame.style.transform = `scale(${scale})`;
  stage.style.width = `${width * scale}px`;
  $('#canvas-title').textContent = `${width === 1440 ? '电脑' : width === 1024 ? '平板' : '手机'}画布 · ${width} px · ${Math.round(scale * 100)}%`;
  if (doc) schedule();
}

function update(change, finish = false) {
  const item = current();
  if (!item) return;
  edits()[item.id] = {...edits()[item.id], ...change};
  apply(item); schedule();
  if (finish) { updateProperties(); commit(); }
}

function pointerDown(event) {
  if (!editing || event.button !== 0 || event.isPrimary === false) return;
  const handle = event.target.closest('[data-handle]');
  let target = handle ? current()?.el : event.target.closest('[data-kc-layer]');
  if (!handle && current()?.kind === 'group' && current().el.contains(target)) target = current().el;
  if (!target) { select(''); return; }
  event.preventDefault(); event.stopPropagation();
  const item = items.find(item => item.el === target);
  if (!item) return;
  select(item.id);
  if (edits()[item.id]?.locked || edits()[item.id]?.hidden) return;
  const change = {...edits()[item.id]};
  const size = dimensions(item);
  gesture = {id:item.id, startX:event.clientX, startY:event.clientY, change, size, handle:handle?.dataset.handle, moved:false};
  doc.documentElement.setPointerCapture(event.pointerId);
}

function pointerMove(event) {
  if (!gesture) return;
  event.preventDefault();
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;
  if (Math.abs(dx) + Math.abs(dy) < 2 && !gesture.moved) return;
  gesture.moved = true;
  const {change, size, handle} = gesture;
  if (!handle) update({x:snap((change.x || 0) + dx), y:snap((change.y || 0) + dy)});
  else {
    const next = {};
    if (/[ew]/.test(handle)) next.w = Math.max(16, snap(size.w + (handle.includes('w') ? -dx : dx)));
    if (/[ns]/.test(handle)) next.h = Math.max(16, snap(size.h + (handle.includes('n') ? -dy : dy)));
    if (handle.includes('w')) next.x = snap((change.x || 0) + size.w - next.w);
    if (handle.includes('n')) next.y = snap((change.y || 0) + size.h - next.h);
    if (current().kind === 'text' && $('#scale-text').checked) {
      const ratio = next.w !== undefined ? next.w / size.w : next.h / size.h;
      next.fontSize = round(Math.min(240, Math.max(8, size.fontSize * ratio)));
    }
    update(next);
  }
  updateProperties();
}

function pointerUp() {
  if (!gesture) return;
  if (gesture.moved) commit();
  gesture = null;
}

function keyDown(event) {
  if (!editing || event.target.closest('input,textarea,select,[contenteditable]') || $('#export-dialog').open) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 1 : -1); return; }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); travel(1); return; }
  if (event.key === 'Escape') { select(''); return; }
  if (!current() || edits()[selected]?.locked) return;
  const arrow = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[event.key];
  if (arrow) {
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const change = edits()[selected] || {};
    update({x:round((change.x || 0) + arrow[0] * step), y:round((change.y || 0) + arrow[1] * step)}, true);
  }
}

async function initialize() {
  doc = frame.contentDocument;
  if (!doc?.documentElement) return;
  if (!doc.querySelector('.archive-home')) {
    if (loadingFrames++ < 600) requestAnimationFrame(initialize);
    else $('#save-state').textContent = '首页未能载入，请刷新页面';
    return;
  }
  loadingFrames = 0;
  const style = doc.createElement('style');
  style.textContent = `
    html{scroll-behavior:auto!important;overflow:hidden!important}body{overflow:visible!important}
    .site-header{position:relative!important;top:auto!important}.page-enter,.archive-collage{animation:none!important}
    .archive-home{overflow:visible!important} .kc-editing .archive-home *{user-select:none!important;-webkit-user-drag:none!important;touch-action:none!important;transition:none!important}
    .kc-editing [data-kc-layer]{cursor:move} .kc-editing .collage-sheet-back:hover{transform:rotate(-8deg)!important}.kc-editing .collage-sheet-front:hover{transform:rotate(-4deg)!important}.kc-editing .collage-primary:hover,.kc-editing .collage-caption:hover,.kc-editing .home-index-portraits>button:hover img{transform:none!important}
    #kc-selection{position:absolute;pointer-events:none;z-index:2147483646;border:1px solid #b6d6bf;box-sizing:border-box;color:#152019;font:var(--kc-label-size) 'Microsoft YaHei',sans-serif;}
    #kc-selection .kc-label{position:absolute;left:-1px;white-space:nowrap;padding:3px 7px;background:#b6d6bf;line-height:1.5;pointer-events:none}
    #kc-selection [data-handle]{position:absolute;width:var(--kc-handle);height:var(--kc-handle);background:#e8f0e7;border:1px solid #597864;pointer-events:auto;box-sizing:border-box;transform:translate(-50%,-50%);padding:0;border-radius:0;min-width:0;min-height:0}
    #kc-selection[data-locked=true] [data-handle]{display:none}
    [data-handle=nw]{left:0;top:0;cursor:nwse-resize}[data-handle=n]{left:50%;top:0;cursor:ns-resize}[data-handle=ne]{left:100%;top:0;cursor:nesw-resize}[data-handle=e]{left:100%;top:50%;cursor:ew-resize}[data-handle=se]{left:100%;top:100%;cursor:nwse-resize}[data-handle=s]{left:50%;top:100%;cursor:ns-resize}[data-handle=sw]{left:0;top:100%;cursor:nesw-resize}[data-handle=w]{left:0;top:50%;cursor:ew-resize}
  `;
  doc.head.append(style);
  doc.documentElement.classList.toggle('kc-editing', editing);
  doc.querySelectorAll('.site-header select').forEach(input => { input.disabled = true; });
  const loadedDocument = doc;
  await Promise.race([doc.fonts.ready, new Promise(resolve => setTimeout(resolve, 1800))]);
  if (frame.contentDocument !== loadedDocument) return;
  items = [];
  $('#layers').replaceChildren();
  for (const [title, definitionsInGroup] of definitions) {
    const group = document.createElement('details'); group.className = 'layer-group'; group.open = true;
    const summary = document.createElement('summary'); summary.textContent = title; group.append(summary);
    for (const [id, selector, name, kind, child] of definitionsInGroup) {
      const el = doc.querySelector(selector);
      if (!el) continue;
      const css = frame.contentWindow.getComputedStyle(el);
      const image = kind === 'image' ? el.querySelector('img') : null;
      const imageCSS = image ? frame.contentWindow.getComputedStyle(image) : null;
      const item = {id, name, kind, el, image, originalStyle:el.getAttribute('style'), originalText:el.textContent, originalImageStyle:image?.getAttribute('style') ?? null, base:{display:css.display, position:css.position, z:parseInt(css.zIndex) || 0, fit:imageCSS?.objectFit, imageY:parseFloat(imageCSS?.objectPosition.split(' ')[1]) || 50}};
      items.push(item); el.dataset.kcLayer = id;
      const button = document.createElement('button');
      button.className = `layer${child ? ' child' : ''}`; button.dataset.id = id;
      const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = {group:'▧', module:'□', text:'T', image:'▨'}[kind];
      const label = document.createElement('span'); label.textContent = name;
      const status = document.createElement('span'); status.className = 'state';
      button.append(glyph, label, status); button.addEventListener('click', () => select(id, true)); group.append(button);
    }
    if (group.children.length > 1) $('#layers').append(group);
  }
  overlay = doc.createElement('div'); overlay.id = 'kc-selection';
  const label = doc.createElement('span'); label.className = 'kc-label'; overlay.append(label);
  for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const handle = doc.createElement('button'); handle.type = 'button'; handle.dataset.handle = direction;
    handle.setAttribute('aria-label', `缩放 ${direction}`); overlay.append(handle);
  }
  doc.body.append(overlay);
  doc.addEventListener('pointerdown', pointerDown, true);
  doc.addEventListener('pointermove', pointerMove, true);
  doc.addEventListener('pointerup', pointerUp, true);
  doc.addEventListener('pointercancel', pointerUp, true);
  doc.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); }, true);
  doc.addEventListener('dragstart', event => event.preventDefault(), true);
  doc.addEventListener('keydown', keyDown, true);
  doc.addEventListener('wheel', event => {
    event.preventDefault();
    scroller.scrollBy({top:event.deltaY, left:event.deltaX});
  }, {passive:false});
  $('#layer-count').textContent = `${items.length} 个`;
  history = [state()]; historyIndex = 0;
  $('#undo').disabled = true; $('#redo').disabled = true;
  applyAll(); fitCanvas();
  $('#save-state').textContent = Object.keys(edits()).length ? '已恢复上次调整' : '可自由拖动与缩放';
  for (const image of doc.images) if (!image.complete) image.addEventListener('load', schedule, {once:true});
  select(items.some(item => item.id === selected) ? selected : 'title');
}

frame.addEventListener('load', initialize);
$('#device').addEventListener('change', event => {
  if (gesture) pointerUp();
  width = Number(event.target.value); selected = '';
  loadingFrames = 0;
  frame.style.width = `${width}px`; frame.style.height = '900px';
  scroller.scrollTo(0, 0); fitCanvas(); frame.src = '/';
});
$('#zoom').addEventListener('change', fitCanvas);
new ResizeObserver(fitCanvas).observe(scroller);
new ResizeObserver(() => {
  const height = document.querySelector('.toolbar').offsetHeight;
  document.documentElement.style.setProperty('--toolbar-height', `${height}px`);
  document.querySelector('.workspace').style.height = `calc(100dvh - ${height}px)`;
}).observe(document.querySelector('.toolbar'));
$('#mobile-properties').addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-properties-open');
  $('#mobile-properties').setAttribute('aria-pressed', String(open));
  $('#mobile-properties').textContent = open ? '收起属性' : '属性';
});
$('#undo').addEventListener('click', () => travel(-1));
$('#redo').addEventListener('click', () => travel(1));
document.addEventListener('keydown', keyDown);
$('#preview').addEventListener('click', () => {
  editing = !editing;
  document.body.classList.toggle('preview-mode', !editing);
  doc?.documentElement.classList.toggle('kc-editing', editing);
  $('#preview').textContent = editing ? '预览效果' : '返回编辑';
  $('#preview').setAttribute('aria-pressed', String(!editing));
  drawOverlay();
});
form.addEventListener('change', event => {
  const input = event.target;
  const name = input.name;
  if (!fields.includes(name) || !current()) return;
  let value = input.type === 'checkbox' ? input.checked : ['text','font','fit'].includes(name) ? input.value : Number(input.value);
  if (typeof value === 'number' && !Number.isFinite(value)) return;
  const ranges = {w:[16,6000], h:[16,6000], fontSize:[8,240], lineHeight:[.8,4], opacity:[0,100], imageY:[0,100]};
  if (ranges[name]) value = Math.max(ranges[name][0], Math.min(ranges[name][1], value));
  update({[name]:value}, true);
});
form.elements.imageY.addEventListener('input', event => update({imageY:Number(event.target.value)}));
for (const button of document.querySelectorAll('[data-align]')) button.addEventListener('click', () => {
  const item = current(); if (!item || edits()[selected]?.locked) return;
  const parent = item.el.parentElement.getBoundingClientRect();
  const rect = item.el.getBoundingClientRect();
  const target = button.dataset.align === 'left' ? parent.left : button.dataset.align === 'right' ? parent.right - rect.width : parent.left + (parent.width - rect.width) / 2;
  update({x:round((edits()[selected]?.x || 0) + target - rect.left)}, true);
});
$('#reset-one').addEventListener('click', () => { if (current()) { delete edits()[selected]; applyAll(); commit(); } });
$('#reset-all').addEventListener('click', () => {
  if (!Object.keys(edits()).length || !confirm('还原当前画布尺寸的所有调整？其他尺寸的调整仍会保留。')) return;
  layouts[width] = {}; applyAll(); commit();
});

function exported() {
  const layerNames = Object.fromEntries(items.map(item => [item.id, item.name]));
  return JSON.stringify({application:'Kingdom Come', type:'homepage-layout', version:1, savedAt:new Date().toISOString(), note:'仅首页；x/y 为相对原布局的像素位移，w/h 为 CSS 像素。不同画布尺寸独立保存。', layerNames, layouts}, null, 2);
}
$('#export').addEventListener('click', () => {
  $('#export-json').value = exported(); $('#export-status').textContent = ''; $('#export-dialog').showModal();
});
$('#close-export').addEventListener('click', () => $('#export-dialog').close());
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#export-json').value); $('#export-status').textContent = '已复制，可以直接粘贴发给我。'; }
  catch { $('#export-json').focus(); $('#export-json').select(); $('#export-status').textContent = '请按 Ctrl / ⌘ + C 复制选中的配置。'; }
});
$('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('#export-json').value], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'kingdom-come-home-layout.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#export-status').textContent = '配置已下载。';
});
$('#import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const config = JSON.parse(await file.text());
    if (config.type !== 'homepage-layout' || config.version !== 1 || !config.layouts || typeof config.layouts !== 'object') throw new Error('请选择本预览页导出的布局配置。');
    const clean = {};
    for (const [device, changes] of Object.entries(config.layouts)) {
      if (!['1440','1024','390'].includes(device) || !changes || typeof changes !== 'object') continue;
      clean[device] = {};
      for (const [id, change] of Object.entries(changes)) {
        if (!definitions.some(([,list]) => list.some(row => row[0] === id)) || !change || typeof change !== 'object') continue;
        const valid = {};
        for (const key of fields) {
          const value = change[key];
          if (['hidden','locked'].includes(key) && typeof value === 'boolean') valid[key] = value;
          else if (['text','font'].includes(key) && typeof value === 'string') valid[key] = value.slice(0,4000);
          else if (key === 'fit' && ['cover','contain'].includes(value)) valid[key] = value;
          else if (!['text','font','fit','hidden','locked'].includes(key) && typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000) valid[key] = value;
        }
        clean[device][id] = valid;
      }
    }
    layouts = clean; applyAll(); commit(); $('#export-json').value = exported();
    $('#export-status').textContent = '已导入，可以关闭窗口继续调整。';
  } catch (error) { $('#export-status').textContent = error.message || '配置文件无法读取。'; }
  event.target.value = '';
});
fitCanvas();
